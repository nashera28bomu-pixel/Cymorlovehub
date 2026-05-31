// ─── src/modules/groq.js ─────────────────────────────────────────────────────
import Groq from 'groq-sdk';
import { CONFIG } from '../config.js';

const groq = new Groq({ apiKey: CONFIG.groqKey });

const conversations = new Map(); // phone → message history

export async function askGroq(phone, userMessage, systemPrompt = null) {
  // Maintain per-user conversation (last 10 messages)
  if (!conversations.has(phone)) conversations.set(phone, []);
  const history = conversations.get(phone);

  history.push({ role: 'user', content: userMessage });
  if (history.length > 20) history.splice(0, 2); // keep last 10 exchanges

  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...history]
    : history;

  const res = await groq.chat.completions.create({
    model:      CONFIG.groqModel,
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  const reply = res.choices[0]?.message?.content || 'No response.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

export function clearGroqHistory(phone) {
  conversations.delete(phone);
}

// ─── Specific AI tasks ────────────────────────────────────────────────────────

export async function roastName(name) {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: 'You are a funny, playful roast comedian. Keep roasts fun and not offensive. Max 4 sentences.' },
      { role: 'user',   content: `Roast the name "${name}" in a funny way` },
    ],
    max_tokens: 200,
  });
  return res.choices[0]?.message?.content || '';
}

export async function translateText(text, targetLang) {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: `You are a translator. Translate text to ${targetLang}. Return ONLY the translated text, nothing else.` },
      { role: 'user',   content: text },
    ],
    max_tokens: 500,
  });
  return res.choices[0]?.message?.content || '';
}

export async function fixGrammar(text) {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: 'Fix the grammar and spelling of the given text. Return ONLY the corrected text.' },
      { role: 'user',   content: text },
    ],
    max_tokens: 500,
  });
  return res.choices[0]?.message?.content || '';
}

export async function summarizeText(text) {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: 'Summarize the given text in 3-5 clear bullet points. Use WhatsApp formatting (*bold*, • bullets).' },
      { role: 'user',   content: text },
    ],
    max_tokens: 400,
  });
  return res.choices[0]?.message?.content || '';
}

export async function getAdvice() {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: 'Give one powerful, motivational piece of life advice. Keep it under 4 sentences. Be inspiring.' },
      { role: 'user',   content: 'Give me life advice' },
    ],
    max_tokens: 150,
  });
  return res.choices[0]?.message?.content || '';
}

export async function getLyrics(song) {
  const res = await groq.chat.completions.create({
    model: CONFIG.groqModel,
    messages: [
      { role: 'system', content: 'You know song lyrics. Provide the chorus and first verse of the requested song. If unknown, say so clearly.' },
      { role: 'user',   content: `Lyrics for: ${song}` },
    ],
    max_tokens: 400,
  });
  return res.choices[0]?.message?.content || '';
}
