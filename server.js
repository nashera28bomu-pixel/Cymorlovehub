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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const logger = pino({ level: 'silent' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active pairing sessions in memory
const pairingSessions = new Map();

// ─── Health check (keep Render free tier awake) ───────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'alive', bot: CONFIG.botName, owner: CONFIG.ownerName }));

// ─── Serve pair.html ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ─── Generate QR or pairing code for a phone number ──────────────────────────
app.post('/api/pair', async (req, res) => {
  const { phone, method } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  // Clean up old session for this phone
  if (pairingSessions.has(cleanPhone)) {
    try { pairingSessions.get(cleanPhone).sock?.end(); } catch {}
    pairingSessions.delete(cleanPhone);
  }

  const sessionId = `session_${cleanPhone}_${Date.now()}`;
  const sessionPath = `./data/sessions/${sessionId}`;
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

    pairingSessions.set(cleanPhone, { sock, sessionId, sessionPath, status: 'pending', qr: null, code: null });
    sock.ev.on('creds.update', saveCreds);

    if (method === 'code') {
      // Pairing code method
      await new Promise(r => setTimeout(r, 2000));
      try {
        const code = await sock.requestPairingCode(cleanPhone);
        pairingSessions.get(cleanPhone).code = code;
        pairingSessions.get(cleanPhone).status = 'code_ready';
        res.json({ success: true, method: 'code', code: code.match(/.{1,4}/g).join('-') });
      } catch (err) {
        res.status(500).json({ error: 'Failed to generate pairing code: ' + err.message });
      }
    } else {
      // QR method
      sock.ev.on('connection.update', async ({ qr, connection }) => {
        if (qr) {
          try {
            const qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            pairingSessions.get(cleanPhone).qr = qrImage;
            pairingSessions.get(cleanPhone).status = 'qr_ready';
          } catch {}
        }
        if (connection === 'open') {
          pairingSessions.get(cleanPhone).status = 'connected';
          // Save session ID to DB
          saveSession(cleanPhone, sessionId);
          // Zip the session folder as session ID string
          const sessionData = fs.readdirSync(sessionPath)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ name: f, data: fs.readFileSync(path.join(sessionPath, f), 'utf8') }));
          pairingSessions.get(cleanPhone).sessionData = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        }
      });
      // Return pending and let client poll for QR
      res.json({ success: true, method: 'qr', message: 'Generating QR code, please poll /api/status' });
    }

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      if (pairingSessions.has(cleanPhone)) {
        try { pairingSessions.get(cleanPhone).sock?.end(); } catch {}
        pairingSessions.delete(cleanPhone);
        try { fs.rmSync(sessionPath, { recursive: true }); } catch {}
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Poll pairing status ──────────────────────────────────────────────────────
app.get('/api/status/:phone', (req, res) => {
  const phone = req.params.phone.replace(/[^0-9]/g, '');
  const session = pairingSessions.get(phone);
  if (!session) return res.json({ status: 'not_found' });

  res.json({
    status:      session.status,
    qr:          session.qr || null,
    code:        session.code || null,
    sessionId:   session.status === 'connected' ? session.sessionId : null,
    sessionData: session.status === 'connected' ? session.sessionData : null,
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`\n🌐 Pair page running at https://smileycymorbot.onrender.com`);
});


export default app;
