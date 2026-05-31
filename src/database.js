// ─── src/database.js (lowdb — pure JS, Render-safe) ──────────────────────────
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, '../../data');
const DB_FILE   = path.join(DATA_DIR, 'cymor.json');

// Safe directory creation — handles Render creating 'data' as a file
try {
  const stat = fs.statSync(DATA_DIR);
  if (!stat.isDirectory()) {
    fs.rmSync(DATA_DIR, { force: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaults = {
  users:      {},
  sessions:   {},
  elimu:      {},
  elimu_msgs: {},
  elimu_stats:{},
  antilink:   {},
  welcome:    {},
  autostatus: {},
  antidelete: {},
  bot_stats:  { total_users: 0, total_cmds: 0 },
};

const adapter = new JSONFile(DB_FILE);
const db      = new Low(adapter, defaults);
await db.read();
for (const key of Object.keys(defaults)) db.data[key] ??= defaults[key];
await db.write();

async function save() {
  try { await db.write(); } catch (e) { console.error('DB save error:', e.message); }
}

// ── User helpers ──────────────────────────────────────────────────────────────
export function getUser(phone) {
  if (!db.data.users[phone]) {
    db.data.users[phone] = {
      phone, name: 'User', registered: false, premium: false,
      banned: false, warns: 0,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    db.data.bot_stats.total_users++;
    save();
  }
  db.data.users[phone].last_seen = new Date().toISOString();
  return db.data.users[phone];
}

export function setUserName(phone, name) {
  const u = getUser(phone); u.name = name; u.registered = true; save();
}

export function isBanned(phone)        { return db.data.users[phone]?.banned === true; }
export function isPremium(phone)       { return db.data.users[phone]?.premium === true; }
export function setPremium(phone, val) { getUser(phone); db.data.users[phone].premium = !!val; save(); }
export function banUser(phone)         { getUser(phone); db.data.users[phone].banned = true;  save(); }
export function unbanUser(phone)       { getUser(phone); db.data.users[phone].banned = false; save(); }
export function addWarn(phone)         { getUser(phone); db.data.users[phone].warns = (db.data.users[phone].warns||0)+1; save(); return db.data.users[phone].warns; }
export function resetWarns(phone)      { getUser(phone); db.data.users[phone].warns = 0; save(); }
export function getTotalUsers()        { return Object.keys(db.data.users).length; }
export function incCmdCount()          { db.data.bot_stats.total_cmds++; save(); }
export function getBotStats()          { return db.data.bot_stats; }
export function getAllUsers()          { return Object.keys(db.data.users); }

// ── Session helpers ───────────────────────────────────────────────────────────
export function saveSession(phone, sessionId) { db.data.sessions[phone] = sessionId; save(); }
export function getSession(phone)             { return db.data.sessions[phone] || null; }

// ── Auto-status ───────────────────────────────────────────────────────────────
export function setAutoStatus(phone, val)  { db.data.autostatus[phone] = !!val; save(); }
export function getAutoStatus(phone)       { return !!db.data.autostatus[phone]; }
export function getAllAutoStatus()         { return Object.keys(db.data.autostatus).filter(p => db.data.autostatus[p]); }

// ── Anti-delete ───────────────────────────────────────────────────────────────
export function setAntiDelete(phone, val) { db.data.antidelete[phone] = !!val; save(); }
export function getAntiDelete(phone)      { return !!db.data.antidelete[phone]; }

// ── Group features ────────────────────────────────────────────────────────────
export function setAntiLink(jid, val)     { db.data.antilink[jid] = !!val; save(); }
export function getAntiLink(jid)          { return !!db.data.antilink[jid]; }
export function setWelcome(jid, val, msg) { db.data.welcome[jid] = { enabled: !!val, message: msg||null }; save(); }
export function getWelcome(jid)           { return db.data.welcome[jid] || null; }

// ── Elimu helpers ─────────────────────────────────────────────────────────────
export function getElimu(phone) {
  if (!db.data.elimu[phone]) {
    db.data.elimu[phone] = {
      phone, name:'Student', grade:null, curriculum:null,
      bot_active:true, mode:'ask', current_topic:null,
      setup_done:false, setup_step:0,
    };
    db.data.elimu_stats[phone] = { questions_asked:0, practice_done:0, total_score:0, total_marked:0 };
    save();
  }
  return db.data.elimu[phone];
}

export function updateElimu(phone, fields) {
  getElimu(phone); Object.assign(db.data.elimu[phone], fields); save();
}

export function saveElimMsg(phone, role, content) {
  if (!db.data.elimu_msgs[phone]) db.data.elimu_msgs[phone] = [];
  db.data.elimu_msgs[phone].push({ role, content, ts: Date.now() });
  if (db.data.elimu_msgs[phone].length > 40) {
    db.data.elimu_msgs[phone] = db.data.elimu_msgs[phone].slice(-40);
  }
  save();
}

export function getElimHistory(phone, limit=8) {
  const msgs = db.data.elimu_msgs[phone] || [];
  return msgs.slice(-limit).map(m => ({ role: m.role, content: m.content }));
}

export function clearElimHistory(phone) { db.data.elimu_msgs[phone] = []; save(); }

export function incElimQuestion(phone)     { getElimu(phone); db.data.elimu_stats[phone].questions_asked++; save(); }
export function incElimPractice(phone)     { getElimu(phone); db.data.elimu_stats[phone].practice_done++;  save(); }
export function addElimScore(phone, score) {
  getElimu(phone);
  db.data.elimu_stats[phone].total_score  += score;
  db.data.elimu_stats[phone].total_marked++;
  save();
}
export function getElimStats(phone) { return db.data.elimu_stats[phone] || {}; }
