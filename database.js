// ─── src/database.js ─────────────────────────────────────────────────────────
import Database from 'better-sqlite3';
import fs from 'fs';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

const db = new Database('./data/cymor.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone        TEXT PRIMARY KEY,
    name         TEXT DEFAULT 'User',
    registered   INTEGER DEFAULT 0,
    premium      INTEGER DEFAULT 0,
    banned       INTEGER DEFAULT 0,
    warns        INTEGER DEFAULT 0,
    joined_at    TEXT DEFAULT (datetime('now')),
    last_seen    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    phone        TEXT PRIMARY KEY,
    session_id   TEXT UNIQUE,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS elimu (
    phone        TEXT PRIMARY KEY,
    name         TEXT DEFAULT 'Student',
    grade        TEXT DEFAULT NULL,
    curriculum   TEXT DEFAULT NULL,
    bot_active   INTEGER DEFAULT 1,
    mode         TEXT DEFAULT 'ask',
    current_topic TEXT DEFAULT NULL,
    setup_done   INTEGER DEFAULT 0,
    setup_step   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS elimu_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT,
    role       TEXT,
    content    TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS elimu_stats (
    phone            TEXT PRIMARY KEY,
    questions_asked  INTEGER DEFAULT 0,
    practice_done    INTEGER DEFAULT 0,
    total_score      INTEGER DEFAULT 0,
    total_marked     INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bot_stats (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    total_cmds    INTEGER DEFAULT 0,
    total_users   INTEGER DEFAULT 0,
    uptime_start  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS antilink (
    group_jid TEXT PRIMARY KEY,
    enabled   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS welcome (
    group_jid TEXT PRIMARY KEY,
    enabled   INTEGER DEFAULT 0,
    message   TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS autostatus (
    phone   TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS antidelete (
    phone   TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO bot_stats (id) VALUES (1);
`);

// ── User helpers ──────────────────────────────────────────────────────────────
export const getUser = (phone) => {
  let u = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (!u) {
    db.prepare('INSERT OR IGNORE INTO users (phone) VALUES (?)').run(phone);
    db.prepare('UPDATE bot_stats SET total_users=total_users+1 WHERE id=1').run();
    u = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  }
  db.prepare("UPDATE users SET last_seen=datetime('now') WHERE phone=?").run(phone);
  return u;
};

export const setUserName   = (phone, name) => db.prepare('UPDATE users SET name=?,registered=1 WHERE phone=?').run(name, phone);
export const isBanned      = (phone) => db.prepare('SELECT banned FROM users WHERE phone=?').get(phone)?.banned === 1;
export const isPremium     = (phone) => db.prepare('SELECT premium FROM users WHERE phone=?').get(phone)?.premium === 1;
export const setPremium    = (phone, val) => db.prepare('UPDATE users SET premium=? WHERE phone=?').run(val, phone);
export const banUser       = (phone) => db.prepare('UPDATE users SET banned=1 WHERE phone=?').run(phone);
export const unbanUser     = (phone) => db.prepare('UPDATE users SET banned=0 WHERE phone=?').run(phone);
export const addWarn       = (phone) => { db.prepare('UPDATE users SET warns=warns+1 WHERE phone=?').run(phone); return db.prepare('SELECT warns FROM users WHERE phone=?').get(phone)?.warns; };
export const resetWarns    = (phone) => db.prepare('UPDATE users SET warns=0 WHERE phone=?').run(phone);
export const getTotalUsers = () => db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
export const incCmdCount   = () => db.prepare('UPDATE bot_stats SET total_cmds=total_cmds+1 WHERE id=1').run();
export const getBotStats   = () => db.prepare('SELECT * FROM bot_stats WHERE id=1').get();

// ── Session helpers ───────────────────────────────────────────────────────────
export const saveSession   = (phone, sessionId) => db.prepare('INSERT OR REPLACE INTO sessions (phone,session_id) VALUES (?,?)').run(phone, sessionId);
export const getSession    = (phone) => db.prepare('SELECT session_id FROM sessions WHERE phone=?').get(phone)?.session_id;

// ── Auto-status helpers ───────────────────────────────────────────────────────
export const setAutoStatus = (phone, val) => db.prepare('INSERT OR REPLACE INTO autostatus (phone,enabled) VALUES (?,?)').run(phone, val);
export const getAutoStatus = (phone) => db.prepare('SELECT enabled FROM autostatus WHERE phone=?').get(phone)?.enabled === 1;
export const getAllAutoStatus = () => db.prepare('SELECT phone FROM autostatus WHERE enabled=1').all().map(r => r.phone);

// ── Anti-delete helpers ───────────────────────────────────────────────────────
export const setAntiDelete = (phone, val) => db.prepare('INSERT OR REPLACE INTO antidelete (phone,enabled) VALUES (?,?)').run(phone, val);
export const getAntiDelete = (phone) => db.prepare('SELECT enabled FROM antidelete WHERE phone=?').get(phone)?.enabled === 1;

// ── Group feature helpers ─────────────────────────────────────────────────────
export const setAntiLink   = (jid, val) => db.prepare('INSERT OR REPLACE INTO antilink (group_jid,enabled) VALUES (?,?)').run(jid, val);
export const getAntiLink   = (jid) => db.prepare('SELECT enabled FROM antilink WHERE group_jid=?').get(jid)?.enabled === 1;
export const setWelcome    = (jid, val, msg=null) => db.prepare('INSERT OR REPLACE INTO welcome (group_jid,enabled,message) VALUES (?,?,?)').run(jid, val, msg);
export const getWelcome    = (jid) => db.prepare('SELECT * FROM welcome WHERE group_jid=?').get(jid);

// ── Elimu helpers ─────────────────────────────────────────────────────────────
export const getElimu      = (phone) => { db.prepare('INSERT OR IGNORE INTO elimu (phone) VALUES (?)').run(phone); db.prepare('INSERT OR IGNORE INTO elimu_stats (phone) VALUES (?)').run(phone); return db.prepare('SELECT * FROM elimu WHERE phone=?').get(phone); };
export const updateElimu   = (phone, fields) => {
  const sets = Object.keys(fields).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE elimu SET ${sets} WHERE phone=?`).run(...Object.values(fields), phone);
};
export const saveElimMsg   = (phone, role, content) => db.prepare('INSERT INTO elimu_messages (phone,role,content) VALUES (?,?,?)').run(phone, role, content);
export const getElimHistory= (phone, limit=8) => db.prepare('SELECT role,content FROM elimu_messages WHERE phone=? ORDER BY created_at DESC LIMIT ?').all(phone, limit).reverse().map(r=>({role:r.role,content:r.content}));
export const clearElimHistory = (phone) => db.prepare('DELETE FROM elimu_messages WHERE phone=?').run(phone);
export const incElimQuestion  = (phone) => db.prepare('UPDATE elimu_stats SET questions_asked=questions_asked+1 WHERE phone=?').run(phone);
export const incElimPractice  = (phone) => db.prepare('UPDATE elimu_stats SET practice_done=practice_done+1 WHERE phone=?').run(phone);
export const addElimScore     = (phone, score) => db.prepare('UPDATE elimu_stats SET total_score=total_score+?,total_marked=total_marked+1 WHERE phone=?').run(score, phone);
export const getElimStats     = (phone) => db.prepare('SELECT * FROM elimu_stats WHERE phone=?').get(phone) || {};
