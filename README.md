# 🌟 SMILEY CYMOR BOT
### *The Legendary WhatsApp Bot by Cymor Tech Services*
> **"Always a winner"** — Legendary Smiley Cymor

## ✅ Fixed: No native dependencies — runs on Render free tier!
Uses `lowdb` (pure JS JSON database) — no `better-sqlite3` compilation errors.

## Quick Setup
```bash
npm install
cp .env.example .env   # fill in API keys
npm start              # scan QR → bot is live
```

## Key Files
| File | Purpose |
|------|---------|
| `index.js` | WhatsApp connection + event handlers |
| `server.js` | Express web server + pairing page API |
| `public/pair.html` | User-facing pairing page |
| `src/router.js` | All 80+ commands |
| `src/menu.js` | Menu layouts + welcome message |
| `src/database.js` | lowdb JSON storage |
| `src/modules/groq.js` | Groq AI (chat, translate, roast...) |
| `src/modules/elimu.js` | Claude Kenyan tutor |
| `src/modules/downloader.js` | YouTube, TikTok, Instagram downloads |
| `src/modules/search.js` | Weather, Wiki, fun commands |

## Required API Keys (.env)
```
GROQ_API_KEY=       # console.groq.com (free)
ANTHROPIC_API_KEY=  # console.anthropic.com (free $5)
WEATHER_API_KEY=    # openweathermap.org (free)
OWNER_NUMBER=       # your number with country code
BOT_NUMBER=         # bot's number with country code
```

## Deploy on Render
1. Push to GitHub
2. New Web Service → Build: `npm install` → Start: `node server.js`
3. Add all env vars in Render dashboard
4. Add UptimeRobot ping to `/health` every 5 mins

## Commands (80+)
`.menu` `.play` `.ai` `.sticker` `.vv` `.tiktok` `.weather` `.ask` `.revise` `.kcse` `.translate` `.roast` `.ytmp3` `.wiki` `.joke` `.ship` `.8ball` `.tagall` `.antidelete` `.autostatus` `.fact` `.define` `.currency` `.calc` and many more.

_Powered by Cymor Tech Services | Always a winner 🏆_
