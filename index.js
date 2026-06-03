// ─── index.js ────────────────────────────────────────────────────────────────
import 'dotenv/config';
import fs from 'fs';
import pino from 'pino';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore
} from '@whiskeysockets/baileys';

import { handleMessage } from './src/router.js';
import { CONFIG } from './src/config.js';
import {
  getAllAutoStatus,
  getAntiDelete,
  getWelcome,
  getAntiLink
} from './src/database.js';

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

const messageCache = new Map();

// ─── Ensure session exists ──────────────────────────────────────────────────
if (!fs.existsSync(CONFIG.sessionFolder)) {
  console.log('❌ No session found. Please pair your bot first using /api/pair');
  process.exit(1);
}

// ─── Extract message text ────────────────────────────────────────────────────
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

// ─── Main bot function ───────────────────────────────────────────────────────
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      CONFIG.sessionFolder
    );

    const { version } = await fetchLatestBaileysVersion();

    console.log(`\n🚀 Starting ${CONFIG.botName}...\n`);

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

    // ─── Connection handling ────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`\n✅ ${CONFIG.botName} ONLINE`);
        console.log(`📱 Logged in as: ${sock.user?.id}\n`);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;

        console.log('⚠ Connection closed:', code);

        if (code !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting...');
          setTimeout(startBot, 5000);
        } else {
          console.log('❌ Logged out. Re-pair required.');
          process.exit(1);
        }
      }
    });

    // ─── Message handler ─────────────────────────────────────────────────────
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

          // ─── Anti-link ────────────────────────────────────────────────
          if (isGroup) {
            const body = extractText(msg);

            if (getAntiLink(jid) && /https?:\/\//i.test(body)) {
              try {
                await sock.groupParticipantsUpdate(
                  jid,
                  [msg.key.participant],
                  'remove'
                );

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
          console.error('Message Error:', err.message);
        }
      }
    });

    // ─── Status auto-view ────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid !== 'status@broadcast') continue;

        const viewers = getAllAutoStatus();

        if (viewers.length > 0) {
          try {
            await sock.readMessages([msg.key]);
          } catch {}
        }
      }
    });

    // ─── Anti-delete ─────────────────────────────────────────────────────────
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

    // ─── Group welcome/goodbye ──────────────────────────────────────────────
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
    console.error('Fatal Bot Error:', err);
    setTimeout(startBot, 10000);
  }
}

startBot();
