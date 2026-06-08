// ─── src/botRunner.js ─────────────────────────────────────────────────────────
import fs from 'fs';
import pino from 'pino';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore
} from '@whiskeysockets/baileys';

import { handleMessage } from './router.js';
import {
  getAllAutoStatus,
  getAntiDelete,
  getWelcome,
  getAntiLink
} from './database.js';

const logger = pino({ level: 'silent' });

// Track all running bot instances: phone -> sock
export const activeBots = new Map();

// ─── Extract message text ─────────────────────────────────────────────────────
function extractText(msg) {
  const m = msg?.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    ''
  );
}

// ─── Start a bot for a specific user ─────────────────────────────────────────
export async function startBot(sessionFolder, phone) {
  // Don't start duplicate if already running
  if (activeBots.has(phone)) {
    console.log(`⚠ Bot for ${phone} already running. Skipping.`);
    return;
  }

  if (!fs.existsSync(sessionFolder)) {
    console.log(`❌ No session found for ${phone} at ${sessionFolder}`);
    return;
  }

  const messageCache = new Map();
  const store = makeInMemoryStore({ logger });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`\n🚀 Starting bot for ${phone}...\n`);

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    // Register as active
    activeBots.set(phone, sock);

    // ─── Connection handling ────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`✅ Bot ONLINE for ${phone} | ID: ${sock.user?.id}`);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        activeBots.delete(phone);
        console.log(`⚠ Bot for ${phone} disconnected. Code: ${code}`);

        if (code !== DisconnectReason.loggedOut) {
          console.log(`🔄 Reconnecting bot for ${phone}...`);
          setTimeout(() => startBot(sessionFolder, phone), 5000);
        } else {
          console.log(`❌ ${phone} logged out. Re-pair required.`);
          // Clean up session so user can re-pair
          try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch {}
        }
      }
    });

    // ─── Message handler ──────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          if (!msg.message || msg.key.fromMe) continue;
          if (msg.key.remoteJid === 'status@broadcast') continue;

          const jid = msg.key.remoteJid;
          const isGroup = jid.endsWith('@g.us');
          const sender =
            msg.key.participant?.replace('@s.whatsapp.net', '') ||
            jid.replace('@s.whatsapp.net', '');

          messageCache.set(msg.key.id, { msg, jid, sender });
          setTimeout(() => messageCache.delete(msg.key.id), 300000);

          // ─── Anti-link ──────────────────────────────────────────────────
          if (isGroup) {
            const body = extractText(msg);
            if (getAntiLink(jid) && /https?:\/\//i.test(body)) {
              try {
                await sock.groupParticipantsUpdate(jid, [msg.key.participant], 'remove');
                await sock.sendMessage(jid, {
                  text: `🔗 Anti-Link: @${sender} removed.`,
                  mentions: [msg.key.participant]
                });
              } catch {}
              continue;
            }
          }

          await handleMessage(sock, msg, isGroup);
        } catch (err) {
          console.error(`Message Error (${phone}):`, err.message);
        }
      }
    });

    // ─── Status auto-view ─────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid !== 'status@broadcast') continue;
        const viewers = getAllAutoStatus();
        if (viewers.length > 0) {
          try { await sock.readMessages([msg.key]); } catch {}
        }
      }
    });

    // ─── Anti-delete ──────────────────────────────────────────────────────────
    sock.ev.on('messages.delete', async (item) => {
      if (!item?.keys) return;
      for (const key of item.keys) {
        const cached = messageCache.get(key.id);
        if (!cached) continue;
        const { msg, jid, sender } = cached;
        if (!getAntiDelete(sender)) continue;
        const body = extractText(msg);
        if (!body) continue;
        try {
          await sock.sendMessage(jid, {
            text: `🗑 Anti-Delete\nFrom: @${sender}\nMessage: ${body}`,
            mentions: [`${sender}@s.whatsapp.net`]
          });
        } catch {}
      }
    });

    // ─── Group welcome/goodbye ────────────────────────────────────────────────
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      const welcome = getWelcome(id);
      if (!welcome?.enabled) return;
      for (const participant of participants) {
        const phone = participant.replace('@s.whatsapp.net', '');
        try {
          if (action === 'add') {
            await sock.sendMessage(id, {
              text: welcome.message || `👋 Welcome @${phone}`,
              mentions: [participant]
            });
          }
          if (action === 'remove') {
            await sock.sendMessage(id, {
              text: `👋 Goodbye @${phone}`,
              mentions: [participant]
            });
          }
        } catch {}
      }
    });

    return sock;

  } catch (err) {
    console.error(`Fatal Bot Error (${phone}):`, err);
    activeBots.delete(phone);
    setTimeout(() => startBot(sessionFolder, phone), 10000);
  }
}
