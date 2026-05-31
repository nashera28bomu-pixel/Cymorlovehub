// ─── src/router.js ───────────────────────────────────────────────────────────
import { CONFIG } from './config.js';
import { buildMainMenu, buildCategoryMenu, WELCOME_DM } from './menu.js';
import {
  getUser, setUserName, isBanned, incCmdCount,
  setAutoStatus, getAutoStatus, setAntiDelete, getAntiDelete,
  banUser, unbanUser, setPremium, getBotStats, getTotalUsers,
  setAntiLink, setWelcome,
  getElimu, updateElimu, clearElimHistory,
} from './database.js';

import { askGroq, clearGroqHistory, roastName, translateText, fixGrammar, summarizeText, getAdvice, getLyrics } from './modules/groq.js';
import { elimuAnswer, elimuPractice, elimuMark, elimuRevise, elimuKcse, elimuSolve, elimuStats } from './modules/elimu.js';
import { playMusic, downloadVideo, ytToMp3, ytToMp4, downloadTikTok, downloadInstagram, downloadTwitter } from './modules/downloader.js';
import { getWeather, getWiki, getDefinition, convertCurrency, getTime, calculate, getJoke, getFact, getQuote, getRiddle, getTruth, getDare, magicBall, shipUsers, rollDice, flipCoin } from './modules/search.js';
import { START_TIME } from './config.js';

const P = CONFIG.prefix;

// ─── Route a message ──────────────────────────────────────────────────────────
export async function handleMessage(sock, msg, isGroup) {
  const jid   = msg.key.remoteJid;
  const phone = jid.replace('@s.whatsapp.net','').replace('@c.us','').replace(/@g\.us.*/,'');
  const sender= msg.key.participant?.replace('@s.whatsapp.net','') || phone;
  const body  = extractText(msg);
  const isCmd = body.startsWith(P);

  // ── New user greeting ───────────────────────────────────────────────────────
  const user = getUser(sender);
  if (!user.registered && !isGroup) {
    const name = msg.pushName || 'Friend';
    setUserName(sender, name);
    await sock.sendMessage(jid, { text: WELCOME_DM(name) });
    return;
  }

  // ── Banned check ─────────────────────────────────────────────────────────────
  if (isBanned(sender)) {
    await sock.sendMessage(jid, { text: '🚫 You are banned from using this bot.' });
    return;
  }

  // ── Only process commands in DMs (or if tagged in groups) ───────────────────
  if (!isCmd) {
    // Handle antidelete tracking — done in main index.js
    return;
  }

  incCmdCount();

  // Parse command + args
  const parts   = body.slice(P.length).trim().split(/\s+/);
  const cmd     = parts[0].toLowerCase();
  const args    = parts.slice(1);
  const text    = args.join(' ');
  const isOwner = sender === CONFIG.ownerNumber;

  // Quoted message
  const quoted  = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';

  try {
    await sock.sendPresenceUpdate('composing', jid);

    // ── MENU ────────────────────────────────────────────────────────────────
    if (cmd === 'menu' || cmd === 'm') {
      if (args[0]) {
        const cat = buildCategoryMenu(args[0].toLowerCase());
        if (cat) { await send(sock, jid, cat); return; }
      }
      await send(sock, jid, buildMainMenu(user.name || msg.pushName));
      return;
    }

    // ── INFO ────────────────────────────────────────────────────────────────
    if (cmd === 'ping') {
      const start = Date.now();
      await send(sock, jid, `🏓 *Pong!* Response: *${Date.now() - start}ms*\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'runtime') {
      const ms = Date.now() - START_TIME;
      const s  = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
      const up = d>0?`${d}d ${h%24}h ${m%60}m`:h>0?`${h}h ${m%60}m`:`${m}m ${s%60}s`;
      await send(sock, jid, `⏱ *Bot Runtime*\n\nOnline for: *${up}*\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'botinfo') {
      const stats = getBotStats();
      await send(sock, jid, `🤖 *${CONFIG.botName}*\n\n👑 Owner: ${CONFIG.ownerName}\n💬 Motto: ${CONFIG.motto}\n👥 Users: *${getTotalUsers()}*\n🔢 Commands run: *${stats?.total_cmds||0}*\n🤖 AI: Groq (llama3-70b) + Claude (Elimu)\n📱 Platform: WhatsApp via Baileys\n\n_${CONFIG.footer}_`);
      return;
    }

    // ── AI (GROQ) ───────────────────────────────────────────────────────────
    if (cmd === 'ai' || cmd === 'gpt' || cmd === 'chat') {
      if (!text) { await send(sock, jid, `❓ Usage: *.ai* [your question]\nExample: *.ai* What is the capital of Kenya?`); return; }
      const reply = await askGroq(sender, text);
      await send(sock, jid, `🤖 *Groq AI*\n\n${reply}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'translate') {
      const lang = args[0]; const t = args.slice(1).join(' ') || quotedText;
      if (!lang || !t) { await send(sock, jid, `❓ Usage: *.translate* [language] [text]\nExample: *.translate french Hello how are you*`); return; }
      const res = await translateText(t, lang);
      await send(sock, jid, `🌐 *Translation to ${lang}*\n\n${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'fix') {
      const t = text || quotedText;
      if (!t) { await send(sock, jid, `❓ Usage: Reply to a message with *.fix* or type *.fix* [text]`); return; }
      const res = await fixGrammar(t);
      await send(sock, jid, `✍ *Grammar Fixed*\n\n*Before:* ${t.slice(0,100)}\n\n*After:* ${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'summarize') {
      const t = text || quotedText;
      if (!t) { await send(sock, jid, `❓ Reply to a message with *.summarize* or type *.summarize* [text]`); return; }
      const res = await summarizeText(t);
      await send(sock, jid, `📝 *Summary*\n\n${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'roast') {
      const name = text || user.name;
      const res  = await roastName(name);
      await send(sock, jid, `🔥 *Roasting ${name}...*\n\n${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'advice') {
      const res = await getAdvice();
      await send(sock, jid, `💡 *Life Advice*\n\n${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'lyrics') {
      if (!text) { await send(sock, jid, `❓ Usage: *.lyrics* [song name]`); return; }
      const res = await getLyrics(text);
      await send(sock, jid, `🎵 *Lyrics: ${text}*\n\n${res}\n\n_${CONFIG.footer}_`);
      return;
    }

    // ── MUSIC & DOWNLOADS ───────────────────────────────────────────────────
    if (cmd === 'play') {
      if (!text) { await send(sock, jid, `❓ Usage: *.play* [song name]\nExample: *.play* Rema Calm Down`); return; }
      await send(sock, jid, `🔍 Searching for *${text}*...`);
      const { filePath, info } = await playMusic(text);
      await sock.sendMessage(jid, {
        audio: { url: filePath },
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${info.title}.mp3`,
      });
      await send(sock, jid, `🎵 *${info.title}*\n⏱ ${info.duration} | 👀 ${info.views?.toLocaleString()||'N/A'} views\n👤 ${info.author||''}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'video') {
      if (!text) { await send(sock, jid, `❓ Usage: *.video* [name]\nExample: *.video* Burna Boy Last Last`); return; }
      await send(sock, jid, `⏬ Downloading *${text}*... (may take a moment)`);
      const { filePath, info } = await downloadVideo(text);
      await sock.sendMessage(jid, { video: { url: filePath }, caption: `🎬 *${info.title}*\n_${CONFIG.footer}_` });
      return;
    }

    if (cmd === 'ytmp3') {
      if (!text) { await send(sock, jid, `❓ Usage: *.ytmp3* [YouTube URL]`); return; }
      await send(sock, jid, `⏬ Converting to MP3...`);
      const { filePath, title } = await ytToMp3(text);
      await sock.sendMessage(jid, { audio: { url: filePath }, mimetype: 'audio/mpeg', fileName: `${title}.mp3` });
      await send(sock, jid, `✅ *${title}*\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'ytmp4') {
      if (!text) { await send(sock, jid, `❓ Usage: *.ytmp4* [YouTube URL]`); return; }
      await send(sock, jid, `⏬ Converting to MP4...`);
      const { filePath, title } = await ytToMp4(text);
      await sock.sendMessage(jid, { video: { url: filePath }, caption: `🎬 *${title}*\n_${CONFIG.footer}_` });
      return;
    }

    if (cmd === 'tiktok') {
      if (!text) { await send(sock, jid, `❓ Usage: *.tiktok* [TikTok URL]`); return; }
      await send(sock, jid, `⏬ Downloading TikTok...`);
      const { filePath, title } = await downloadTikTok(text);
      await sock.sendMessage(jid, { video: { url: filePath }, caption: `🎵 *${title}*\n_${CONFIG.footer}_` });
      return;
    }

    if (cmd === 'ig') {
      if (!text) { await send(sock, jid, `❓ Usage: *.ig* [Instagram post/reel URL]`); return; }
      await send(sock, jid, `⏬ Downloading from Instagram...`);
      const { filePath } = await downloadInstagram(text);
      await sock.sendMessage(jid, { video: { url: filePath }, caption: `📸 Instagram Video\n_${CONFIG.footer}_` });
      return;
    }

    if (cmd === 'twitter') {
      if (!text) { await send(sock, jid, `❓ Usage: *.twitter* [tweet URL]`); return; }
      await send(sock, jid, `⏬ Downloading Twitter video...`);
      const { filePath } = await downloadTwitter(text);
      await sock.sendMessage(jid, { video: { url: filePath }, caption: `🐦 Twitter Video\n_${CONFIG.footer}_` });
      return;
    }

    // ── STICKER ─────────────────────────────────────────────────────────────
    if (cmd === 's' || cmd === 'sticker') {
      const quoted = getQuotedMedia(msg);
      if (!quoted) { await send(sock, jid, `❓ Send an image/GIF with caption *.s* or reply to an image with *.s*`); return; }
      await send(sock, jid, `⏳ Creating sticker...`);
      // Sticker conversion handled in index.js via sharp/ffmpeg
      await sock.sendMessage(jid, { sticker: quoted.data });
      return;
    }

    // ── WHATSAPP TOOLS ───────────────────────────────────────────────────────
    if (cmd === 'vv') {
      const vvQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!vvQuoted) { await send(sock, jid, `❓ Reply to a view-once message with *.vv*`); return; }
      const mediaType = Object.keys(vvQuoted).find(k => ['imageMessage','videoMessage','audioMessage'].includes(k));
      if (!mediaType) { await send(sock, jid, `❌ No view-once media found in quoted message.`); return; }
      const media = await sock.downloadMediaMessage({ message: vvQuoted });
      const mime  = vvQuoted[mediaType]?.mimetype || 'image/jpeg';
      await sock.sendMessage(jid, { [mime.startsWith('video') ? 'video' : mime.startsWith('audio') ? 'audio' : 'image']: media, mimetype: mime, caption: `💾 View-once saved!\n\n_${CONFIG.footer}_` });
      return;
    }

    if (cmd === 'autostatus') {
      const val = args[0]?.toLowerCase();
      if (val === 'on')  { setAutoStatus(sender, 1); await send(sock, jid, `✅ *Auto Status ON*\nI will now auto-view all statuses! 👀\n\n_${CONFIG.footer}_`); return; }
      if (val === 'off') { setAutoStatus(sender, 0); await send(sock, jid, `⏸ *Auto Status OFF*\nAuto-viewing disabled.\n\n_${CONFIG.footer}_`); return; }
      await send(sock, jid, `❓ Usage: *.autostatus on* or *.autostatus off*\nCurrently: *${getAutoStatus(sender)?'ON':'OFF'}*`);
      return;
    }

    if (cmd === 'antidelete') {
      const val = args[0]?.toLowerCase();
      if (val === 'on')  { setAntiDelete(sender, 1); await send(sock, jid, `✅ *Anti-Delete ON*\nI will recover deleted messages for you!\n\n_${CONFIG.footer}_`); return; }
      if (val === 'off') { setAntiDelete(sender, 0); await send(sock, jid, `⏸ *Anti-Delete OFF*\n\n_${CONFIG.footer}_`); return; }
      await send(sock, jid, `❓ Usage: *.antidelete on* or *.antidelete off*\nCurrently: *${getAntiDelete(sender)?'ON':'OFF'}*`);
      return;
    }

    if (cmd === 'react') {
      const emoji = text || '❤';
      if (!quoted) { await send(sock, jid, `❓ Reply to a message with *.react* [emoji]`); return; }
      await sock.sendMessage(jid, { react: { text: emoji, key: msg.message.extendedTextMessage.contextInfo.stanzaId } });
      return;
    }

    if (cmd === 'delete' || cmd === 'del') {
      if (!quoted) { await send(sock, jid, `❓ Reply to a bot message with *.delete*`); return; }
      await sock.sendMessage(jid, { delete: msg.message.extendedTextMessage.contextInfo.stanzaId });
      return;
    }

    // ── SEARCH & INFO ────────────────────────────────────────────────────────
    if (cmd === 'weather') {
      if (!text) { await send(sock, jid, `❓ Usage: *.weather* [city]\nExample: *.weather Nairobi*`); return; }
      const res = await getWeather(text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'wiki') {
      if (!text) { await send(sock, jid, `❓ Usage: *.wiki* [topic]`); return; }
      const res = await getWiki(text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'define') {
      if (!text) { await send(sock, jid, `❓ Usage: *.define* [word]`); return; }
      const res = await getDefinition(text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'currency') {
      if (args.length < 3) { await send(sock, jid, `❓ Usage: *.currency* [amount] [from] [to]\nExample: *.currency 100 USD KES*`); return; }
      const res = await convertCurrency(args[0], args[1], args[2]);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'calc') {
      if (!text) { await send(sock, jid, `❓ Usage: *.calc* [expression]\nExample: *.calc 25 * 4 + 10*`); return; }
      const res = calculate(text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'time') {
      if (!text) { await send(sock, jid, `❓ Usage: *.time* [city]\nExample: *.time Nairobi*`); return; }
      const res = await getTime(text);
      await send(sock, jid, res);
      return;
    }

    // ── FUN ──────────────────────────────────────────────────────────────────
    if (cmd === 'joke')   { await send(sock, jid, `😂 *Joke of the Day*\n\n${getJoke()}\n\n_${CONFIG.footer}_`); return; }
    if (cmd === 'fact')   { await send(sock, jid, `💡 *Interesting Fact*\n\n${getFact()}\n\n_${CONFIG.footer}_`); return; }
    if (cmd === 'quote')  { await send(sock, jid, getQuote() + `\n\n_${CONFIG.footer}_`); return; }
    if (cmd === 'truth')  { await send(sock, jid, `❓ *Truth Question*\n\n${getTruth()}\n\n_${CONFIG.footer}_`); return; }
    if (cmd === 'dare')   { await send(sock, jid, `🎭 *Dare!*\n\n${getDare()}\n\n_${CONFIG.footer}_`); return; }
    if (cmd === 'flip')   { await send(sock, jid, flipCoin()); return; }

    if (cmd === 'riddle') {
      const r = getRiddle();
      await send(sock, jid, `🧩 *Riddle*\n\n${r.q}\n\n_Reply *.answer* to reveal the answer!_\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'answer') {
      const r = getRiddle();
      await send(sock, jid, `💡 *Answer*\n\n${r.a}\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === '8ball') {
      if (!text) { await send(sock, jid, `❓ Usage: *.8ball* [your question]`); return; }
      await send(sock, jid, magicBall(text));
      return;
    }

    if (cmd === 'roll') {
      await send(sock, jid, rollDice(args[0]));
      return;
    }

    if (cmd === 'ship') {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const u1 = mentions[0]?.replace('@s.whatsapp.net','') || args[0] || 'Person 1';
      const u2 = mentions[1]?.replace('@s.whatsapp.net','') || args[1] || 'Person 2';
      await send(sock, jid, shipUsers(u1, u2));
      return;
    }

    // ── ELIMU TUTOR ─────────────────────────────────────────────────────────
    if (cmd === 'ask') {
      if (!text) { await send(sock, jid, `❓ Usage: *.ask* [your question]\nExample: *.ask* What is photosynthesis?`); return; }
      const res = await elimuAnswer(sender, text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'solve') {
      if (!text) { await send(sock, jid, `❓ Usage: *.solve* [math/science problem]`); return; }
      const res = await elimuSolve(sender, text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'practice') {
      if (!text) { await send(sock, jid, `❓ Usage: *.practice* [topic]\nExample: *.practice Quadratic Equations*`); return; }
      const res = await elimuPractice(sender, text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'mark') {
      const answer = text || quotedText;
      if (!answer) { await send(sock, jid, `❓ Usage: *.mark* [your answer]\nOr reply to a question with *.mark*`); return; }
      const res = await elimuMark(sender, answer);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'revise') {
      if (!text) { await send(sock, jid, `❓ Usage: *.revise* [topic]\nExample: *.revise Photosynthesis*`); return; }
      const res = await elimuRevise(sender, text);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'kcse') {
      const subject = text || 'Mathematics';
      const res = await elimuKcse(sender, subject);
      await send(sock, jid, res);
      return;
    }

    if (cmd === 'mygrades') {
      await send(sock, jid, elimuStats(sender));
      return;
    }

    if (cmd === 'elimureset') {
      clearElimHistory(sender);
      updateElimu(sender, { mode: 'ask', current_topic: null });
      await send(sock, jid, `🔄 *Elimu session reset!* Start fresh!\n\n_${CONFIG.footer}_`);
      return;
    }

    // ── GROUP COMMANDS ───────────────────────────────────────────────────────
    if (isGroup) {
      const groupMeta  = await sock.groupMetadata(jid);
      const botIsAdmin = groupMeta.participants.find(p => p.id.includes(CONFIG.ownerNumber))?.admin;
      const senderIsAdmin = groupMeta.participants.find(p => p.id.includes(sender))?.admin;

      if (cmd === 'tagall') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Only group admins can use *.tagall*`); return; }
        const members = groupMeta.participants.map(p => p.id);
        const mentions = members;
        const tagText  = text || '📢 Attention everyone!';
        const tagList  = members.map(m => `@${m.replace('@s.whatsapp.net','')}`).join(' ');
        await sock.sendMessage(jid, { text: `${tagText}\n\n${tagList}`, mentions });
        return;
      }

      if (cmd === 'groupinfo') {
        const info = `👥 *Group Info*\n\n*Name:* ${groupMeta.subject}\n*Members:* ${groupMeta.participants.length}\n*Admins:* ${groupMeta.participants.filter(p=>p.admin).length}\n*Created:* ${new Date(groupMeta.creation*1000).toLocaleDateString()}\n\n_${CONFIG.footer}_`;
        await send(sock, jid, info);
        return;
      }

      if (cmd === 'antilink') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const val = args[0]?.toLowerCase();
        setAntiLink(jid, val === 'on' ? 1 : 0);
        await send(sock, jid, `🔗 Anti-link is now *${val === 'on' ? 'ON ✅' : 'OFF ❌'}*\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'mute') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        await sock.groupSettingUpdate(jid, 'announcement');
        await send(sock, jid, `🔇 *Group muted.* Only admins can send messages.\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'unmute') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        await sock.groupSettingUpdate(jid, 'not_announcement');
        await send(sock, jid, `🔊 *Group unmuted.* Everyone can send messages.\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'kick') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const target = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) || `${args[0]}@s.whatsapp.net`;
        await sock.groupParticipantsUpdate(jid, [target], 'remove');
        await send(sock, jid, `✅ Member removed.\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'add') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const target = `${args[0]?.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
        await sock.groupParticipantsUpdate(jid, [target], 'add');
        await send(sock, jid, `✅ Member added.\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'promote') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) { await send(sock, jid, `❓ Tag someone to promote: *.promote* @user`); return; }
        await sock.groupParticipantsUpdate(jid, [target], 'promote');
        await send(sock, jid, `⬆ *Promoted to admin!*\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'demote') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) { await send(sock, jid, `❓ Tag someone to demote.`); return; }
        await sock.groupParticipantsUpdate(jid, [target], 'demote');
        await send(sock, jid, `⬇ *Admin role removed.*\n\n_${CONFIG.footer}_`);
        return;
      }

      if (cmd === 'welcome') {
        if (!senderIsAdmin) { await send(sock, jid, `❌ Admins only.`); return; }
        const val = args[0]?.toLowerCase();
        setWelcome(jid, val === 'on' ? 1 : 0, text.slice(3).trim() || null);
        await send(sock, jid, `👋 Welcome messages *${val === 'on' ? 'ON ✅' : 'OFF ❌'}*\n\n_${CONFIG.footer}_`);
        return;
      }
    }

    // ── OWNER COMMANDS ───────────────────────────────────────────────────────
    if (cmd === 'stats' && isOwner) {
      const s = getBotStats();
      await send(sock, jid, `📊 *Bot Statistics*\n\n👥 Total Users: *${getTotalUsers()}*\n🔢 Commands Run: *${s?.total_cmds||0}*\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'ban' && isOwner) {
      const target = args[0]?.replace(/[^0-9]/g,'');
      if (!target) { await send(sock, jid, `❓ Usage: *.ban* [number]`); return; }
      banUser(target);
      await send(sock, jid, `🚫 *${target}* has been banned.\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'unban' && isOwner) {
      const target = args[0]?.replace(/[^0-9]/g,'');
      if (!target) { await send(sock, jid, `❓ Usage: *.unban* [number]`); return; }
      unbanUser(target);
      await send(sock, jid, `✅ *${target}* has been unbanned.\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'addpremium' && isOwner) {
      const target = args[0]?.replace(/[^0-9]/g,'');
      if (!target) { await send(sock, jid, `❓ Usage: *.addpremium* [number]`); return; }
      setPremium(target, 1);
      await send(sock, jid, `💎 *${target}* is now a premium user!\n\n_${CONFIG.footer}_`);
      return;
    }

    if (cmd === 'restart' && isOwner) {
      await send(sock, jid, `🔄 Restarting bot...`);
      setTimeout(() => process.exit(0), 1000);
      return;
    }

    // ── UNKNOWN COMMAND ─────────────────────────────────────────────────────
    await send(sock, jid, `❓ Unknown command: *${P}${cmd}*\n\nType *.menu* to see all commands.\n\n_${CONFIG.footer}_`);

  } catch (err) {
    console.error(`❌ Command error [${cmd}]:`, err.message);
    await send(sock, jid, `❌ *Error:* ${err.message || 'Something went wrong.'}\n\nTry again or type *.menu*\n\n_${CONFIG.footer}_`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractText(msg) {
  const m = msg.message;
  return m?.conversation
    || m?.extendedTextMessage?.text
    || m?.imageMessage?.caption
    || m?.videoMessage?.caption
    || m?.documentMessage?.caption
    || '';
}

function getQuotedMedia(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;
  const qm = ctx.quotedMessage;
  if (qm.imageMessage) return { type: 'image', data: qm.imageMessage };
  if (qm.videoMessage) return { type: 'video', data: qm.videoMessage };
  if (qm.stickerMessage) return { type: 'sticker', data: qm.stickerMessage };
  return null;
}

async function send(sock, jid, text) {
  await sock.sendMessage(jid, { text });
}
