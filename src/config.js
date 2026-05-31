// ─── src/config.js ───────────────────────────────────────────────────────────
import 'dotenv/config';

export const CONFIG = {
  botName:     process.env.BOT_NAME      || 'Smiley Cymor Bot',
  ownerName:   process.env.OWNER_NAME    || 'Legendary Smiley Cymor',
  ownerNumber: process.env.OWNER_NUMBER  || '254700000000',
  motto:       process.env.MOTTO         || 'Always a winner',
  footer:      process.env.FOOTER        || 'Powered by Cymor Tech Services',
  prefix:      process.env.PREFIX        || '.',
  port:        process.env.PORT || 10000,
  sessionFolder: process.env.SESSION_FOLDER || './auth_info',

  groqModel:   process.env.GROQ_MODEL    || 'llama3-70b-8192',
  claudeModel: process.env.CLAUDE_MODEL  || 'claude-haiku-4-5-20251001',

  groqKey:     process.env.GROQ_API_KEY,
  anthropicKey:process.env.ANTHROPIC_API_KEY,
  weatherKey:  process.env.WEATHER_API_KEY,
};

// Bot start time for uptime tracking
export const START_TIME = Date.now();
