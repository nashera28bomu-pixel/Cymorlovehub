import 'dotenv/config';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

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

if (!fs.existsSync(CONFIG.sessionFolder)) {
fs.mkdirSync(CONFIG.sessionFolder, { recursive: true });
}

const store = makeInMemoryStore({ logger });
const messageCache = new Map();

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
  browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0']
});

store.bind(sock.ev);

sock.ev.on('creds.update', saveCreds);

sock.ev.on(
  'connection.update',
  async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan QR Code:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ ${CONFIG.botName} Connected`);
      console.log(`📱 ${sock.user?.id}`);
    }

    if (connection === 'close') {
      const code =
        lastDisconnect?.error?.output?.statusCode;

      console.log('⚠ Connection Closed:', code);

      if (code !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconnecting...');
        setTimeout(startBot, 5000);
      } else {
        console.log('❌ Logged Out');
        process.exit(1);
      }
    }
  }
);

sock.ev.on(
  'messages.upsert',
  async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') continue;

        const isGroup = jid.endsWith('@g.us');

        const sender =
          msg.key.participant?.replace(
            '@s.whatsapp.net',
            ''
          ) ||
          jid.replace('@s.whatsapp.net', '');

        messageCache.set(msg.key.id, {
          msg,
          jid,
          sender
        });

        setTimeout(() => {
          messageCache.delete(msg.key.id);
        }, 300000);

        if (isGroup) {
          const body = extractText(msg);

          if (
            getAntiLink(jid) &&
            /https?:\/\//i.test(body)
          ) {
            try {
              await sock.groupParticipantsUpdate(
                jid,
                [msg.key.participant],
                'remove'
              );

              await sock.sendMessage(jid, {
                text:
                  `🔗 Anti-Link Enabled\n\n` +
                  `@${sender} removed.`,
                mentions: [msg.key.participant]
              });
            } catch {}
            continue;
          }
        }

        await handleMessage(
          sock,
          msg,
          isGroup
        );
      } catch (err) {
        console.error(
          'Message Error:',
          err.message
        );
      }
    }
  }
);

sock.ev.on(
  'messages.upsert',
  async ({ messages }) => {
    for (const msg of messages) {
      if (
        msg.key.remoteJid !==
        'status@broadcast'
      )
        continue;

      const viewers = getAllAutoStatus();

      if (viewers.length > 0) {
        try {
          await sock.readMessages([msg.key]);
        } catch {}
      }
    }
  }
);

sock.ev.on(
  'messages.delete',
  async item => {
    if (!item?.keys) return;

    for (const key of item.keys) {
      const cached = messageCache.get(key.id);

      if (!cached) continue;

      const {
        msg,
        jid,
        sender
      } = cached;

      if (!getAntiDelete(sender))
        continue;

      const body = extractText(msg);

      if (!body) continue;

      try {
        await sock.sendMessage(jid, {
          text:
            `🗑 Anti-Delete\n\n` +
            `From: @${sender}\n` +
            `Message: ${body}`,
          mentions: [
            `${sender}@s.whatsapp.net`
          ]
        });
      } catch {}
    }
  }
);

sock.ev.on(
  'group-participants.update',
  async ({
    id,
    participants,
    action
  }) => {
    const welcome = getWelcome(id);

    if (!welcome?.enabled) return;

    for (const participant of participants) {
      const phone = participant.replace(
        '@s.whatsapp.net',
        ''
      );

      try {
        if (action === 'add') {
          await sock.sendMessage(id, {
            text:
              welcome.message ||
              `👋 Welcome @${phone}`,
            mentions: [participant]
          });
        }

        if (action === 'remove') {
          await sock.sendMessage(id, {
            text:
              `👋 Goodbye @${phone}`,
            mentions: [participant]
          });
        }
      } catch {}
    }
  }
);

return sock;

} catch (err) {
console.error(
'Fatal Bot Error:',
err
);

setTimeout(startBot, 10000);

}
}

startBot();
