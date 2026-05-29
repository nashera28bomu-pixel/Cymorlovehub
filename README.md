# 🌟 SMILEY CYMOR BOT
### *The Legendary WhatsApp Bot by Cymor Tech Services*
> **"Always a winner"** — Legendary Smiley Cymor

---

## ✨ What is Smiley Cymor Bot?

A full-featured WhatsApp bot with **80+ commands** combining:
- 🤖 **Groq AI** (llama3-70b) — fast AI chat, translations, summaries
- 📚 **Elimu Tutor** (Claude AI) — Kenyan CBC & 8-4-4 curriculum tutor
- 🎵 **Media Downloads** — YouTube, TikTok, Instagram, Twitter
- 🖼 **Sticker Maker** — image/video to WhatsApp sticker
- 📱 **WhatsApp Tools** — view-once saver, auto-status, anti-delete
- 👥 **Group Manager** — tag-all, anti-link, welcome messages
- 🌍 **Search & Info** — weather, Wikipedia, dictionary, currency
- 🎮 **Fun & Games** — jokes, riddles, ship, magic 8-ball

---

## 📁 Project Structure

```
smiley-cymor-bot/
├── index.js                  ← WhatsApp connection (Baileys) + event handlers
├── server.js                 ← Express web server + pairing page API
├── public/
│   └── pair.html             ← Beautiful pairing page for users
├── src/
│   ├── config.js             ← All environment config constants
│   ├── database.js           ← SQLite database (users, sessions, stats)
│   ├── menu.js               ← All menu layouts + welcome DM message
│   ├── router.js             ← Main command router (all 80+ commands)
│   └── modules/
│       ├── groq.js           ← Groq AI (chat, translate, roast, fix, summarize)
│       ├── elimu.js          ← Claude AI Kenyan tutor (ask, practice, mark, revise)
│       ├── downloader.js     ← YouTube, TikTok, Instagram, Twitter downloads
│       └── search.js         ← Weather, Wiki, dictionary, fun commands
├── prompts/                  ← (auto-used by elimu.js)
├── data/                     ← SQLite DB + temp media files (auto-created)
├── auth_info/                ← WhatsApp session (auto-created on first scan)
├── .env.example              ← Environment template — copy to .env
├── package.json
└── README.md
```

---

## 🛠 Requirements

- **Node.js v18+** → [nodejs.org](https://nodejs.org)
- **A spare phone number** for the bot (NOT your personal WhatsApp)
- **Groq API Key** (free) → [console.groq.com](https://console.groq.com)
- **Anthropic API Key** (free $5 credits) → [console.anthropic.com](https://console.anthropic.com)
- **OpenWeatherMap API Key** (free) → [openweathermap.org/api](https://openweathermap.org/api)

---

## 🚀 Quick Setup (Local)

### 1. Install dependencies
```bash
cd smiley-cymor-bot
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Open `.env` and fill in:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
WEATHER_API_KEY=xxxxxxxxxxxxxxxx
OWNER_NUMBER=254700000000        ← Your number (with country code, no +)
BOT_NUMBER=254700000001          ← The bot's number
```

### 3. Start the bot
```bash
npm start
```

### 4. Scan QR Code
A QR code appears in terminal.
- Open WhatsApp on the **bot phone**
- Tap **⋮ → Linked Devices → Link a Device**
- Scan the QR code

Bot prints `✅ ONLINE!` when connected.

### 5. Test it
Send `.menu` to the bot number from any WhatsApp. You'll get the full command menu!

---

## 🌐 Pairing Page (for your users)

The pairing page lets **other people connect their WhatsApp** to use the bot.

Start the web server separately:
```bash
node server.js
```

Then open: `http://localhost:3000`

Users can:
1. Enter their phone number
2. Choose **Pairing Code** (easiest) or **QR Code**
3. Connect in seconds
4. Get their **Session ID** for self-hosting

---

## ☁ Deploy on Render (Free Hosting)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/smiley-cymor-bot.git
git push -u origin main
```

### Step 2 — Create Render Service
1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   | Field | Value |
   |-------|-------|
   | **Environment** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

### Step 3 — Add Environment Variables
In Render dashboard → **Environment** tab, add all variables from your `.env`:
- `GROQ_API_KEY`
- `ANTHROPIC_API_KEY`
- `WEATHER_API_KEY`
- `OWNER_NUMBER`
- `BOT_NUMBER`
- `BOT_NAME` → `Smiley Cymor Bot`
- `OWNER_NAME` → `Legendary Smiley Cymor`
- `MOTTO` → `Always a winner`
- `FOOTER` → `Powered by Cymor Tech Services`

### Step 4 — Deploy!
Click **Deploy Service**. Render builds and launches your bot automatically.

### Step 5 — Keep it alive (important!)
Render free tier sleeps after 15 mins of inactivity. Fix this:

1. Go to [uptimerobot.com](https://uptimerobot.com) (free)
2. Add a new HTTP monitor
3. URL: `https://your-render-url.onrender.com/health`
4. Interval: **5 minutes**

This pings your bot every 5 minutes so it never sleeps! ✅

---

## 📱 How to Run BOTH Bot + Web Server

To run the bot AND the pairing page together on one Render instance, change your start command to:

```bash
node index.js & node server.js
```

Or use the provided `npm start` which runs `index.js`. For the web server, set start command to:
```bash
node server.js
```
And import/start the bot from inside `server.js` (already set up).

---

## 💬 Commands Reference

### 📋 Menu & Info
| Command | Description |
|---------|-------------|
| `.menu` | Show main menu |
| `.menu [category]` | Show category menu (music, ai, elimu, tools, group, search, fun, owner) |
| `.ping` | Bot response speed |
| `.runtime` | How long bot has been online |
| `.botinfo` | Bot statistics |

### 🎵 Music & Downloads
| Command | Description |
|---------|-------------|
| `.play [song]` | Search & send audio |
| `.video [name]` | Download & send video |
| `.ytmp3 [url]` | YouTube URL to MP3 |
| `.ytmp4 [url]` | YouTube URL to MP4 |
| `.tiktok [url]` | TikTok (no watermark) |
| `.ig [url]` | Instagram reel/post |
| `.twitter [url]` | Twitter/X video |

### 🤖 AI Features (Groq)
| Command | Description |
|---------|-------------|
| `.ai [question]` | Ask Groq AI anything |
| `.chat [message]` | Conversational AI chat |
| `.translate [lang] [text]` | Translate to any language |
| `.fix` | Fix grammar of quoted text |
| `.summarize` | Summarize quoted text |
| `.roast [name]` | AI roasts a name 🔥 |
| `.advice` | AI life advice |
| `.lyrics [song]` | Song lyrics |

### 📚 Elimu Tutor (Claude AI)
| Command | Description |
|---------|-------------|
| `.ask [question]` | Ask any school question |
| `.solve [problem]` | Solve math step-by-step |
| `.practice [topic]` | Get 3 practice questions |
| `.mark [answer]` | Mark your answer (scored /10) |
| `.revise [topic]` | Quick revision notes |
| `.kcse [subject]` | KCSE/KCPE exam question |
| `.mygrades` | Your learning progress stats |
| `.elimureset` | Reset study session |

### 📱 WhatsApp Tools
| Command | Description |
|---------|-------------|
| `.vv` | Save view-once media |
| `.autostatus on/off` | Auto view all statuses |
| `.antidelete on/off` | Recover deleted messages |
| `.react [emoji]` | React to quoted message |
| `.delete` | Delete bot's last message |

### 🌍 Search & Info
| Command | Description |
|---------|-------------|
| `.weather [city]` | Live weather report |
| `.wiki [topic]` | Wikipedia summary |
| `.define [word]` | Dictionary definition |
| `.currency [amt] [from] [to]` | Currency converter |
| `.calc [expression]` | Calculator |
| `.time [city]` | Time in any city |

### 🎮 Fun & Games
| Command | Description |
|---------|-------------|
| `.joke` | Random joke |
| `.fact` | Interesting fact |
| `.quote` | Inspirational quote |
| `.riddle` | Random riddle |
| `.8ball [question]` | Magic 8-ball |
| `.roll [sides]` | Roll a dice |
| `.flip` | Flip a coin |
| `.ship @user1 @user2` | Love compatibility % |
| `.truth` | Truth question |
| `.dare` | Dare challenge |
| `.lyrics [song]` | Song lyrics |

### 👥 Group Commands (Admin only)
| Command | Description |
|---------|-------------|
| `.add [number]` | Add member |
| `.kick @user` | Remove member |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.mute / .unmute` | Mute/unmute group |
| `.tagall [msg]` | Tag all members |
| `.antilink on/off` | Block link sharing |
| `.welcome on/off` | Welcome new members |
| `.groupinfo` | Group statistics |

### 👑 Owner Commands
| Command | Description |
|---------|-------------|
| `.ban [number]` | Ban a user |
| `.unban [number]` | Unban a user |
| `.addpremium [number]` | Give premium access |
| `.stats` | Full bot statistics |
| `.restart` | Restart the bot |

---

## 💰 Running Cost Estimate

| Service | Free Tier | Enough for |
|---------|-----------|------------|
| **Groq API** | Unlimited free requests | Thousands of AI chats/day |
| **Claude (Anthropic)** | $5 free credits | ~6,000 Elimu tutor sessions |
| **OpenWeatherMap** | 1,000 calls/day free | Plenty for a demo |
| **YouTube (yt-dlp)** | Free | Unlimited |
| **Render** | Free hosting | 24/7 with UptimeRobot |

**Total monthly cost: $0** until you scale beyond the free tiers.

---

## ⚠ Important Notes

1. **Use a dedicated SIM** — never use your personal WhatsApp number for the bot
2. **Baileys** uses WhatsApp Web protocol — avoid spammy behavior to prevent bans
3. The `auth_info/` folder = your WhatsApp session — **never share it or commit to git**
4. The `data/cymor.db` SQLite file holds all user data — back it up regularly
5. Temp media files in `data/tmp/` are auto-deleted every 5 minutes

---

## 🔧 Customization

**Change bot name/owner/motto:**
Edit these in your `.env`:
```env
BOT_NAME=Your Bot Name
OWNER_NAME=Your Name
MOTTO=Your motto here
FOOTER=Powered by Your Company
```

**Change command prefix:**
```env
PREFIX=!
```
Now commands are `!menu`, `!play`, etc.

**Add new commands:**
Open `src/router.js` and add a new `if (cmd === 'yourcommand')` block following the existing pattern.

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| QR not showing | Delete `auth_info/` folder and restart |
| Bot goes offline | Check Render logs; add UptimeRobot ping |
| Downloads failing | YouTube API changes frequently — update `ytdl-core`: `npm update ytdl-core` |
| Groq not responding | Check your `GROQ_API_KEY` in `.env` |
| Elimu not working | Check your `ANTHROPIC_API_KEY` in `.env` |
| Weather failing | Add `WEATHER_API_KEY` from openweathermap.org |

---

## 📞 Support

- **Owner:** Legendary Smiley Cymor
- **Contact:** wa.me/`[OWNER_NUMBER from .env]`

---

*Elimu ni ufunguo wa maisha — Education is the key to life* 📚

---

**Powered by Cymor Tech Services** | *Always a winner* 🏆
