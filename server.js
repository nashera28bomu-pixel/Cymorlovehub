// ─── server.js ───────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

import pino from 'pino';
import QRCode from 'qrcode';

import { saveSession } from './src/database.js';
import { CONFIG } from './src/config.js';

// ─── Setup ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const logger = pino({ level: 'silent' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Active sessions
const pairingSessions = new Map();

// ─── Health Check (Render keep-alive) ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    bot: CONFIG.botName,
    owner: CONFIG.ownerName,
  });
});

// ─── Home page ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ─── Pair endpoint ───────────────────────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
  const { phone, method } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  // cleanup old session if exists
  if (pairingSessions.has(cleanPhone)) {
    try {
      pairingSessions.get(cleanPhone).sock?.end();
    } catch {}
    pairingSessions.delete(cleanPhone);
  }

  const sessionId = `session_${cleanPhone}_${Date.now()}`;
  const sessionPath = path.join('./data/sessions', sessionId);

  fs.mkdirSync(sessionPath, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: ['Smiley Cymor Bot', 'Chrome', '1.0.0'],
    });

    pairingSessions.set(cleanPhone, {
      sock,
      sessionId,
      sessionPath,
      status: 'pending',
      qr: null,
      code: null,
    });

    sock.ev.on('creds.update', saveCreds);

    // ─── Pairing Code Method ───────────────────────────────────────────────
    if (method === 'code') {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(cleanPhone);

          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

          const session = pairingSessions.get(cleanPhone);
          if (session) {
            session.code = formatted;
            session.status = 'code_ready';
          }

          return res.json({
            success: true,
            method: 'code',
            code: formatted,
          });
        } catch (err) {
          return res.status(500).json({
            error: 'Failed to generate pairing code',
            details: err.message,
          });
        }
      }, 2000);

      return;
    }

    // ─── QR Method ──────────────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { qr, connection } = update;

      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
          });

          const session = pairingSessions.get(cleanPhone);
          if (session) {
            session.qr = qrImage;
            session.status = 'qr_ready';
          }
        } catch {}
      }

      if (connection === 'open') {
        const session = pairingSessions.get(cleanPhone);

        if (session) {
          session.status = 'connected';

          saveSession(cleanPhone, sessionId);

          // save session snapshot
          const sessionFiles = fs
            .readdirSync(sessionPath)
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({
              name: f,
              data: fs.readFileSync(path.join(sessionPath, f), 'utf8'),
            }));

          session.sessionData = Buffer.from(
            JSON.stringify(sessionFiles)
          ).toString('base64');
        }
      }
    });

    res.json({
      success: true,
      method: 'qr',
      message: 'QR generation started. Poll /api/status/:phone',
    });

    // ─── Auto cleanup ──────────────────────────────────────────────────────
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
    return res.status(500).json({
      error: err.message,
    });
  }
});

// ─── Status endpoint ─────────────────────────────────────────────────────────
app.get('/api/status/:phone', (req, res) => {
  const phone = req.params.phone.replace(/[^0-9]/g, '');
  const session = pairingSessions.get(phone);

  if (!session) {
    return res.json({ status: 'not_found' });
  }

  res.json({
    status: session.status,
    qr: session.qr || null,
    code: session.code || null,
    sessionId: session.status === 'connected' ? session.sessionId : null,
    sessionData:
      session.status === 'connected' ? session.sessionData : null,
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${CONFIG.port}`);
  console.log(`🔗 https://smileycymorbot.onrender.com`);
});

export default app;
