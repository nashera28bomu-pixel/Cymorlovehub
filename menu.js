// ─── src/menu.js ─────────────────────────────────────────────────────────────
import { CONFIG, START_TIME } from './config.js';
import { getTotalUsers, getBotStats } from './database.js';

function uptime() {
  const ms = Date.now() - START_TIME;
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}d ${h%24}h ${m%60}m`;
  if (h > 0) return `${h}h ${m%60}m`;
  return `${m}m ${s%60}s`;
}

export function buildMainMenu(userName = 'User') {
  const stats = getBotStats();
  const users = getTotalUsers();
  const now   = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  return `
╔═══════════════════════════════╗
║   🌟 *SMILEY CYMOR BOT* 🌟   ║
║   _${CONFIG.motto}_   ║
╚═══════════════════════════════╝

👋 Hey *${userName}*! Welcome back!
🕐 ${now}
⚡ Uptime: *${uptime()}*
👥 Users: *${users}* | 🔢 Cmds Run: *${stats?.total_cmds || 0}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *COMMAND CATEGORIES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 *.menu music*     — Music & Downloads
🖼 *.menu sticker*   — Stickers & Images
🤖 *.menu ai*        — AI Features
📚 *.menu elimu*     — Kenyan Tutor
📱 *.menu tools*     — WhatsApp Tools
👥 *.menu group*     — Group Commands
🌍 *.menu search*    — Search & Info
🎮 *.menu fun*       — Games & Fun
👑 *.menu owner*     — Owner Commands

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Quick Commands*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *.ping*     → Check bot speed
• *.ai* [q]   → Ask AI anything  
• *.play* [s] → Play a song
• *.s*        → Make a sticker
• *.help* [cmd] → Detailed help

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 *Owner:* ${CONFIG.ownerName}
📞 *Contact:* wa.me/${CONFIG.ownerNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_
`.trim();
}

export function buildCategoryMenu(category) {
  const menus = {

    music: `
╔══════════════════════════════╗
║   🎵 *MUSIC & DOWNLOADS*    ║
╚══════════════════════════════╝

🎵 *.play* [song name]
   → Search & send audio

🎬 *.video* [name]
   → Download & send video

📥 *.ytmp3* [YouTube URL]
   → YouTube to MP3

📹 *.ytmp4* [YouTube URL]
   → YouTube to MP4

🎵 *.tiktok* [URL]
   → TikTok (no watermark)

📸 *.ig* [URL]
   → Instagram reel/post

📘 *.fb* [URL]
   → Facebook video

🐦 *.twitter* [URL]
   → Twitter/X video

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    sticker: `
╔══════════════════════════════╗
║   🖼 *STICKERS & IMAGES*    ║
╚══════════════════════════════╝

🖼 *.s* or *.sticker*
   → Image/video → sticker
   (just send with caption .s)

🔄 *.toimg*
   → Sticker → image

✂ *.removebg*
   → Remove image background

😂 *.meme* [top | bottom]
   → Add text to image as meme

🎨 *.enhance*
   → AI enhance/upscale image

📝 *.caption* [text]
   → Add caption to image

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    ai: `
╔══════════════════════════════╗
║      🤖 *AI FEATURES*       ║
╚══════════════════════════════╝

🧠 *.ai* [question]
   → Ask Groq AI anything

💬 *.chat* [message]
   → Have a conversation with AI

🎨 *.imagine* [prompt]
   → Generate AI image (free)

📝 *.summarize*
   → Summarize quoted text

🌐 *.translate* [lang] [text]
   → Translate to any language
   Example: .translate french Hello

✍ *.fix*
   → Fix grammar of quoted text

😂 *.roast* [name]
   → AI roasts a name 🔥

🎯 *.advice*
   → Get AI life advice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Powered by Groq (llama3-70b)_
_${CONFIG.footer}_`,

    elimu: `
╔══════════════════════════════╗
║   📚 *ELIMU — KE TUTOR*     ║
╚══════════════════════════════╝

❓ *.ask* [question]
   → Ask any school question
   (auto-detects grade & subject)

🔢 *.solve* [math problem]
   → Solve any math step-by-step

📝 *.practice* [topic]
   → Get 3 practice questions

✅ *.mark*
   → Mark your practice answer

📖 *.revise* [topic]
   → Quick revision notes

🎯 *.kcse* [subject]
   → KCSE exam-style question

📊 *.mygrades*
   → Your learning stats

🔄 *.elimureset*
   → Reset your study session

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Covers CBC (Grade 1-9)_
_8-4-4 (Form 1-4) & University_
_Powered by Claude AI_
_${CONFIG.footer}_`,

    tools: `
╔══════════════════════════════╗
║    📱 *WHATSAPP TOOLS*      ║
╚══════════════════════════════╝

👁 *.vv*
   → Save view-once media

👀 *.autostatus on/off*
   → Auto view all statuses

📖 *.autoread on/off*
   → Auto read messages

🔒 *.antidelete on/off*
   → Recover deleted messages

💬 *.react* [emoji]
   → React to quoted message

🗑 *.delete* / *.del*
   → Delete bot's message

⏱ *.runtime*
   → Bot uptime

ℹ *.botinfo*
   → Full bot information

📊 *.ping*
   → Bot response speed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    group: `
╔══════════════════════════════╗
║    👥 *GROUP COMMANDS*      ║
╚══════════════════════════════╝

_⚠ Admin-only commands:_

➕ *.add* [number]
   → Add member to group

➖ *.kick* @user
   → Remove member

⬆ *.promote* @user
   → Make admin

⬇ *.demote* @user
   → Remove admin role

🔇 *.mute* / *.unmute*
   → Mute/unmute the group

📢 *.tagall* [message]
   → Tag all group members

🔗 *.antilink on/off*
   → Block link sharing

👋 *.welcome on/off*
   → Welcome new members

👋 *.goodbye on/off*
   → Farewell messages

⚠ *.warn* @user
   → Warn member (3=kick)

ℹ *.groupinfo*
   → Group statistics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    search: `
╔══════════════════════════════╗
║    🌍 *SEARCH & INFO*       ║
╚══════════════════════════════╝

🌤 *.weather* [city]
   → Live weather report

📰 *.news* [topic]
   → Latest news headlines

📖 *.wiki* [topic]
   → Wikipedia summary

📚 *.define* [word]
   → Dictionary definition

💱 *.currency* [amount] [from] [to]
   → Currency converter
   Example: .currency 100 USD KES

🧮 *.calc* [expression]
   → Smart calculator

🕐 *.time* [city]
   → Current time anywhere

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    fun: `
╔══════════════════════════════╗
║      🎮 *FUN & GAMES*       ║
╚══════════════════════════════╝

😂 *.joke*
   → Random funny joke

💡 *.fact*
   → Random interesting fact

🎱 *.8ball* [question]
   → Magic 8-ball answer

🎲 *.roll* [sides]
   → Roll a dice

🪙 *.flip*
   → Flip a coin

❤ *.ship* @user1 @user2
   → Love compatibility %

🎭 *.dare*
   → Dare challenge

❓ *.truth*
   → Truth question

🧩 *.riddle*
   → Random riddle

💬 *.quote*
   → Inspirational quote

🎵 *.lyrics* [song name]
   → Song lyrics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,

    owner: `
╔══════════════════════════════╗
║    👑 *OWNER COMMANDS*      ║
╚══════════════════════════════╝

_Only for ${CONFIG.ownerName}:_

📢 *.broadcast* [message]
   → Message all bot users

🚫 *.ban* [number]
   → Ban a user

✅ *.unban* [number]
   → Unban a user

💎 *.addpremium* [number]
   → Give premium access

📊 *.stats*
   → Full bot statistics

🔄 *.restart*
   → Restart the bot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_`,
  };

  return menus[category] || null;
}

export const WELCOME_DM = (name) => `
╔══════════════════════════════════╗
║  🌟 *SMILEY CYMOR BOT* 🌟      ║
║  _${CONFIG.motto}_         ║
╚══════════════════════════════════╝

👋 *Welcome, ${name}!*

You are now connected to *Smiley Cymor Bot* — the most legendary WhatsApp bot by *${CONFIG.ownerName}*! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *WHAT I CAN DO FOR YOU:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 Download music & videos for free
🤖 Answer any question with Groq AI  
📚 Tutor you with the Kenyan curriculum
🖼 Make & edit stickers instantly
📱 WhatsApp tools (save vv, auto-status...)
🌍 Weather, news, Wikipedia & more
🎮 Games, jokes & fun commands
👥 Full group management

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *HOW TO GET STARTED:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Type *.menu* — see all commands
2️⃣ Type *.ping* — test the bot speed  
3️⃣ Type *.ai* Hello! — chat with AI
4️⃣ Type *.play* [song] — get music
5️⃣ Send any image + *.s* — make sticker

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *Need help?* Contact the owner:
   wa.me/${CONFIG.ownerNumber}

_${CONFIG.motto}_ 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_${CONFIG.footer}_
`.trim();
