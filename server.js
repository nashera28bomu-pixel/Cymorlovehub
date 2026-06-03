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

import { saveSession } from './src/database.js';
import { CONFIG } from './src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const logger = pino({ level: 'silent' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ACTIVE SESSIONS ─────────────────────────────────────────────────────────
const pairingSessions = new Map();

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    bot: CONFIG.botName,
    owner: CONFIG.ownerName
  });
});

// ─── HOME ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ──────────────────────────────────────────────────────────────────────────────
//  REAL BAILEYS PAIRING SYSTEM (FIXED)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
  const { phone, method } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');

  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  let responded = false;

  const safeReply = (data, status = 200) => {
    if (responded) return;
    responded = true;
    return res.status(status).json(data);
  };

  // ─── CLEAN OLD SESSION ────────────────────────────────────────────────────
  if (pairingSessions.has(cleanPhone)) {
    try {
      pairingSessions.get(cleanPhone).sock?.end();
    } catch {}
    pairingSessions.delete(cleanPhone);
  }

  const sessionId = `session_${cleanPhone}_${Date.now()}`;
  const sessionPath = path.join('/tmp', sessionId);

  fs.mkdirSync(sessionPath, { recursive: true });

  try {
    const { version } = await fetchLatestBaileysVersion();

    // ⚠️ IMPORTANT: NO AUTH STATE HERE (THIS FIXES FAKE CODES)
    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0'],
      auth: undefined, // 🔥 CRITICAL FIX
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

    // ─── CONNECTION HANDLER ────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection } = update;

      if (connection === 'open') {
        const session = pairingSessions.get(cleanPhone);

        if (session) {
          session.status = 'connected';
          saveSession(cleanPhone, sessionId);
        }
      }

      if (connection === 'close') {
        const code = update?.lastDisconnect?.error?.output?.statusCode;

        if (code === DisconnectReason.loggedOut) {
          pairingSessions.delete(cleanPhone);
        }
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // PAIRING CODE FLOW (FIXED PROPER TIMING)
    // ────────────────────────────────────────────────────────────────────────
    if (method === 'code') {
      setTimeout(async () => {
        try {
          // 🔥 WAIT FOR SOCKET TO BE READY PROPERLY
          await new Promise((resolve) => {
            const checkReady = setInterval(() => {
              if (sock.user !== undefined || sock.ws?.readyState === 1) {
                clearInterval(checkReady);
                resolve();
              }
            }, 500);
          });

          const code = await sock.requestPairingCode(cleanPhone);

          const formatted =
            code?.match(/.{1,4}/g)?.join('-') || code;

          const session = pairingSessions.get(cleanPhone);

          if (session) {
            session.code = formatted;
            session.status = 'code_ready';
          }

          return safeReply({
            success: true,
            method: 'code',
            code: formatted
          });

        } catch (err) {
          return safeReply({
            error: 'Pairing failed',
            details: err.message
          }, 500);
        }
      }, 4000); // 🔥 IMPORTANT DELAY FOR STABILITY

      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // QR METHOD (OPTIONAL FALLBACK)
    // ────────────────────────────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ qr }) => {
      if (!qr) return;

      try {
        const qrImage = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2
        });

        const session = pairingSessions.get(cleanPhone);

        if (session) {
          session.qr = qrImage;
          session.status = 'qr_ready';
        }
      } catch {}
    });

    safeReply({
      success: true,
      method: 'qr',
      message: 'Pairing initiated'
    });

    // ─── AUTO CLEANUP ────────────────────────────────────────────────────────
    setTimeout(() => {
      const session = pairingSessions.get(cleanPhone);

      if (session) {
        try {
          session.sock?.end();
        } catch {}

        pairingSessions.delete(cleanPhone);

        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch {}
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    return safeReply({
      error: err.message
    }, 500);
  }
});

// ─── STATUS ──────────────────────────────────────────────────────────────────
app.get('/api/status/:phone', (req, res) => {
  const phone = req.params.phone.replace(/[^0-9]/g, '');
  const session = pairingSessions.get(phone);

  if (!session) {
    return res.json({ status: 'not_found' });
  }

  return res.json({
    status: session.status,
    qr: session.qr || null,
    code: session.code || null,
    sessionId: session.status === 'connected' ? session.sessionId : null
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${CONFIG.port}`);
  console.log(`🚀 REAL pairing system active`);
});

export default app;
