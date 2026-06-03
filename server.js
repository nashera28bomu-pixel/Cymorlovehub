// ─── server.js ───────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import makeWASocket, {
  useMultiFileAuthState,
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

// ─── Active sessions ─────────────────────────────────────────────────────────
const pairingSessions = new Map();

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    bot: CONFIG.botName,
    owner: CONFIG.ownerName
  });
});

// ─── Home page ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ──────────────────────────────────────────────────────────────────────────────
//  CLEAN PAIRING SYSTEM (FIXED)
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

  // ─── Cleanup old session ───────────────────────────────────────────────────
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
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0']
    });

    pairingSessions.set(cleanPhone, {
      sock,
      sessionId,
      sessionPath,
      status: 'pending',
      qr: null,
      code: null
    });

    sock.ev.on('creds.update', saveCreds);

    // ─── CONNECTION LISTENER (IMPORTANT) ────────────────────────────────────
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
        const session = pairingSessions.get(cleanPhone);

        if (session) {
          const code = session.lastDisconnect?.error?.output?.statusCode;

          if (code === DisconnectReason.loggedOut) {
            pairingSessions.delete(cleanPhone);
          }
        }
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // PAIRING CODE METHOD (FIXED TIMING)
    // ────────────────────────────────────────────────────────────────────────
    if (method === 'code') {
      setTimeout(async () => {
        try {
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
            error: 'Failed to generate pairing code',
            details: err.message
          }, 500);
        }
      }, 2500);

      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // QR METHOD (OPTIONAL)
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
      message: 'QR generation started'
    });

    // ─── Auto cleanup ────────────────────────────────────────────────────────
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

// ─── STATUS CHECK ────────────────────────────────────────────────────────────
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

// ─── START SERVER ────────────────────────────────────────────────────────────
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${CONFIG.port}`);
  console.log(`🚀 Pair system ready`);
});

export default app;
