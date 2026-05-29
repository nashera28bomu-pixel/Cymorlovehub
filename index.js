// ─── index.js ────────────────────────────────────────────────────────────────
import 'dotenv/config';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';

import { handleMessage } from './src/router.js';
import { CONFIG } from './src/config.js';
import { getAllAutoStatus, getAntiDelete, getWelcome, getAntiLink } from './src/database.js';

const logger = pino({ level: 'silent' });
const store  = makeInMemoryStore({ logger });

if (!fs.existsSync(CONFIG.sessionFolder)) fs.mkdirSync(CONFIG.sessionFolder, { recursive: true });

// Track deleted messages for anti-delete
const messageCache = new Map();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionFolder);
  const { version }          = await fetchLatestBaileysVersion();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║   🌟 ${CONFIG.botName.toUpperCase().padEnd(34)} ║`);
  console.log(`║   👑 ${CONFIG.ownerName.padEnd(34)} ║`);
  console.log(`║   💬 "${CONFIG.motto.padEnd(32)}" ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  const sock = makeWASocket({
    version,
    logger,
    auth:                  state,
    printQRInTerminal:     false,
    browser:               ['Smiley Cymor Bot', 'Chrome', '1.0.0'],
    syncFullHistory:       false,
    generateHighQualityLinkPreview: false,
  });

  store.bind(sock.ev);

  // ── Connection updates ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n👆 WhatsApp → Three dots → Linked Devices → Link a Device\n');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log(`🔄 Reconnecting (code: ${code})...`);
        setTimeout(startBot, 5000);
      } else {
        console.log('❌ Logged out. Delete auth_info and restart.');
        process.exit(0);
      }
    }

    if (connection === 'open') {
      console.log(`\n✅ ${CONFIG.botName} is ONLINE! 🚀`);
      console.log(`📱 Connected as: ${sock.user?.id}`);
      console.log(`👑 Owner: ${CONFIG.ownerName}`);
      console.log(`💬 ${CONFIG.motto}\n`);
      console.log(`🌐 Pair page: http://localhost:${CONFIG.port}\n`);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Incoming messages ───────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const jid      = msg.key.remoteJid;
      const isGroup  = jid.endsWith('@g.us');
      const sender   = msg.key.participant?.replace('@s.whatsapp.net','') || jid.replace('@s.whatsapp.net','');

      // Cache message for anti-delete
      messageCache.set(msg.key.id, { msg, jid, sender });
      setTimeout(() => messageCache.delete(msg.key.id), 5 * 60 * 1000);

      // Anti-link check in groups
      if (isGroup) {
        const body = extractText(msg);
        if (getAntiLink(jid) && /https?:\/\//.test(body)) {
          try {
            await sock.groupParticipantsUpdate(jid, [msg.key.participant], 'remove');
            await sock.sendMessage(jid, { text: `🔗 *Anti-Link:* @${sender} was removed for sending a link.\n\n_${CONFIG.footer}_`, mentions: [msg.key.participant] });
          } catch {}
          continue;
        }
      }

      // Route to command handler
      try {
        await handleMessage(sock, msg, isGroup);
      } catch (err) {
        console.error('Handler error:', err.message);
      }
    }
  });

  // ── Status updates (auto-view) ──────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid !== 'status@broadcast') continue;
      const autoViewers = getAllAutoStatus();
      for (const phone of autoViewers) {
        try {
          await sock.readMessages([msg.key]);
        } catch {}
      }
    }
  });

  // ── Anti-delete ─────────────────────────────────────────────────────────────
  sock.ev.on('messages.delete', async (item) => {
    if (!('keys' in item)) return;
    for (const key of item.keys) {
      const cached = messageCache.get(key.id);
      if (!cached) continue;
      const { msg, jid, sender } = cached;

      // Only forward to users with antidelete ON
      if (!getAntiDelete(sender)) continue;

      const body = extractText(msg.msg);
      if (!body) continue;

      try {
        await sock.sendMessage(jid, {
          text: `🗑 *Anti-Delete*\n\n*From:* @${sender}\n*Message:* ${body}\n\n_${CONFIG.footer}_`,
          mentions: [`${sender}@s.whatsapp.net`],
        });
      } catch {}
    }
  });

  // ── Group participant updates (welcome/goodbye) ─────────────────────────────
  sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {
    const welcome = getWelcome(groupJid);
    if (!welcome?.enabled) return;

    for (const participant of participants) {
      const phone = participant.replace('@s.whatsapp.net','');
      if (action === 'add') {
        const msg = welcome.message || `👋 Welcome @${phone} to the group!\n\n_${CONFIG.footer}_`;
        await sock.sendMessage(groupJid, { text: msg, mentions: [participant] });
      }
      if (action === 'remove') {
        await sock.sendMessage(groupJid, { text: `👋 Goodbye @${phone}! Thanks for being part of us.\n\n_${CONFIG.footer}_`, mentions: [participant] });
      }
    }
  });

  return sock;
}

function extractText(msg) {
  const m = msg?.message;
  return m?.conversation
    || m?.extendedTextMessage?.text
    || m?.imageMessage?.caption
    || m?.videoMessage?.caption
    || '';
}

startBot().catch(err => { console.error('Fatal:', err); process.exit(1); });
