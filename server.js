// ─── server.js ───────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys';

import pino from 'pino';
import QRCode from 'qrcode';

import { saveSession, getSavedSessions } from './src/database.js';
import { CONFIG } from './src/config.js';
import { startBot, activeBots } from './src/botRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const logger = pino({ level: 'silent' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ACTIVE PAIRING SESSIONS ──────────────────────────────────────────────────
const pairingSessions = new Map();

// ─── SESSIONS BASE DIR ────────────────────────────────────────────────────────
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ─── AUTO-RESTORE BOTS ON STARTUP ────────────────────────────────────────────
// Any previously paired user whose session folder exists gets their bot resumed
(async () => {
  console.log('🔁 Restoring saved sessions...');

  let restored = 0;

  try {
    const saved = getSavedSessions(); // { phone, sessionId }[]

    for (const { phone, sessionId } of saved) {
      const sessionPath = path.join(SESSIONS_DIR, sessionId);

      if (fs.existsSync(sessionPath)) {
        console.log(`  ↪ Restoring bot for ${phone}`);
        startBot(sessionPath, phone);
        restored++;
      }
    }
  } catch (err) {
    // getSavedSessions might not exist yet on first run
  }

  console.log(`✅ Restored ${restored} session(s)\n`);
})();

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    bot: CONFIG.botName,
    owner: CONFIG.ownerName,
    activeBots: activeBots.size
  });
});

// ─── HOME ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ─── ACTIVE BOTS COUNT (for dashboard use) ───────────────────────────────────
app.get('/api/bots', (req, res) => {
  const list = [];
  for (const [phone] of activeBots) {
    list.push({ phone: phone.slice(0, 4) + '****' }); // mask for privacy
  }
  res.json({ count: activeBots.size, bots: list });
});

// ──────────────────────────────────────────────────────────────────────────────
//  PAIRING ENDPOINT
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
  const { phone, method } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  // ─── Already running? ──────────────────────────────────────────────────────
  if (activeBots.has(cleanPhone)) {
    return res.json({
      success: true,
      already: true,
      message: 'Bot already running for this number'
    });
  }

  let responded = false;
  const safeReply = (data, status = 200) => {
    if (responded) return;
    responded = true;
    return res.status(status).json(data);
  };

  // ─── Clean old pairing attempt ────────────────────────────────────────────
  if (pairingSessions.has(cleanPhone)) {
    try { pairingSessions.get(cleanPhone).sock?.end(); } catch {}
    pairingSessions.delete(cleanPhone);
  }

  const sessionId = `session_${cleanPhone}_${Date.now()}`;
  const sessionPath = path.join(SESSIONS_DIR, sessionId);

  fs.mkdirSync(sessionPath, { recursive: true });

  try {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0'],
      auth: undefined,
      markOnlineOnConnect: false
    });

    pairingSessions.set(cleanPhone, {
      sock,
      sessionId,
      sessionPath,
      status: 'initializing',
      qr: null,
      code: null
    });

    // ─── Connection handler ────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection } = update;

      if (connection === 'open') {
        const session = pairingSessions.get(cleanPhone);

        if (session) {
          session.status = 'connected';

          // ✅ Save session to DB
          saveSession(cleanPhone, sessionId);

          console.log(`\n🎉 ${cleanPhone} paired! Launching bot...\n`);

          // ✅ Auto-launch bot for this user
          startBot(sessionPath, cleanPhone);

          pairingSessions.delete(cleanPhone);
        }
      }

      if (connection === 'close') {
        const code = update?.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          pairingSessions.delete(cleanPhone);
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
        }
      }
    });

    // ─── PAIRING CODE FLOW ─────────────────────────────────────────────────
    if (method === 'code') {
      setTimeout(async () => {
        try {
          await new Promise((resolve) => {
            const checkReady = setInterval(() => {
              if (sock.user !== undefined || sock.ws?.readyState === 1) {
                clearInterval(checkReady);
                resolve();
              }
            }, 500);
          });

          const code = await sock.requestPairingCode(cleanPhone);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

          const session = pairingSessions.get(cleanPhone);
          if (session) {
            session.code = formatted;
            session.status = 'code_ready';
          }

          return safeReply({ success: true, method: 'code', code: formatted });

        } catch (err) {
          return safeReply({ error: 'Pairing failed', details: err.message }, 500);
        }
      }, 4000);

      return;
    }

    // ─── QR FLOW ───────────────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ qr }) => {
      if (!qr) return;
      try {
        const qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        const session = pairingSessions.get(cleanPhone);
        if (session) {
          session.qr = qrImage;
          session.status = 'qr_ready';
        }
      } catch {}
    });

    safeReply({ success: true, method: 'qr', message: 'Pairing initiated' });

    // ─── Auto cleanup after 5 min if not connected ────────────────────────
    setTimeout(() => {
      const session = pairingSessions.get(cleanPhone);
      if (session && session.status !== 'connected') {
        try { session.sock?.end(); } catch {}
        pairingSessions.delete(cleanPhone);
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
        console.log(`🧹 Cleaned up abandoned pairing for ${cleanPhone}`);
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    return safeReply({ error: err.message }, 500);
  }
});

// ─── STATUS ───────────────────────────────────────────────────────────────────
app.get('/api/status/:phone', (req, res) => {
  const phone = req.params.phone.replace(/[^0-9]/g, '');

  // Check if bot is fully running
  if (activeBots.has(phone)) {
    return res.json({ status: 'connected', running: true });
  }

  // Check if still pairing
  const session = pairingSessions.get(phone);
  if (!session) return res.json({ status: 'not_found' });

  return res.json({
    status: session.status,
    qr: session.qr || null,
    code: session.code || null
  });
});

// ─── START SERVER ──────────────────────────────────────────────────────────────
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`🌐 ${CONFIG.botName} server on port ${CONFIG.port}`);
  console.log(`🚀 Multi-user pairing system active`);
});

export default app;
