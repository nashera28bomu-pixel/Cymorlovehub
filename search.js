// ─── src/modules/search.js ───────────────────────────────────────────────────
import axios from 'axios';
import { CONFIG } from '../config.js';

// ─── Weather ──────────────────────────────────────────────────────────────────
export async function getWeather(city) {
  if (!CONFIG.weatherKey) throw new Error('Weather API key not set. Add WEATHER_API_KEY to .env');
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${CONFIG.weatherKey}&units=metric`;
  const res = await axios.get(url, { timeout: 10000 });
  const d   = res.data;

  const emoji = {
    Clear: '☀', Clouds: '⛅', Rain: '🌧', Drizzle: '🌦',
    Thunderstorm: '⛈', Snow: '❄', Mist: '🌫', Fog: '🌁',
  }[d.weather[0]?.main] || '🌤';

  return `${emoji} *Weather in ${d.name}, ${d.sys.country}*

🌡 *Temp:* ${Math.round(d.main.temp)}°C (feels like ${Math.round(d.main.feels_like)}°C)
💧 *Humidity:* ${d.main.humidity}%
💨 *Wind:* ${Math.round(d.wind.speed * 3.6)} km/h
☁ *Condition:* ${d.weather[0]?.description}
👁 *Visibility:* ${(d.visibility / 1000).toFixed(1)} km
📈 *High:* ${Math.round(d.main.temp_max)}°C | 📉 *Low:* ${Math.round(d.main.temp_min)}°C

_${CONFIG.footer}_`;
}

// ─── Wikipedia ────────────────────────────────────────────────────────────────
export async function getWiki(query) {
  const search = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    { timeout: 10000 }
  );
  const d = search.data;
  if (!d.extract) throw new Error('No Wikipedia article found for: ' + query);

  const extract = d.extract.length > 800 ? d.extract.slice(0, 800) + '...' : d.extract;
  return `📖 *${d.title}*\n\n${extract}\n\n🔗 ${d.content_urls?.desktop?.page || ''}\n\n_${CONFIG.footer}_`;
}

// ─── Dictionary ───────────────────────────────────────────────────────────────
export async function getDefinition(word) {
  const res  = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 10000 });
  const data = res.data[0];
  if (!data) throw new Error('Word not found: ' + word);

  const meanings = data.meanings.slice(0, 2).map(m => {
    const defs = m.definitions.slice(0, 2).map((d, i) => `  ${i + 1}. ${d.definition}`).join('\n');
    return `*${m.partOfSpeech}:*\n${defs}`;
  }).join('\n\n');

  const phonetic = data.phonetics?.find(p => p.text)?.text || '';

  return `📚 *${data.word}* ${phonetic ? `_(${phonetic})_` : ''}\n\n${meanings}\n\n_${CONFIG.footer}_`;
}

// ─── Currency converter ───────────────────────────────────────────────────────
export async function convertCurrency(amount, from, to) {
  const res = await axios.get(
    `https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`,
    { timeout: 10000 }
  );
  const rate = res.data.rates[to.toUpperCase()];
  if (!rate) throw new Error(`Unknown currency: ${to}`);
  const result = (parseFloat(amount) * rate).toFixed(2);
  return `💱 *Currency Conversion*\n\n*${amount} ${from.toUpperCase()}* = *${result} ${to.toUpperCase()}*\n\n_Rate: 1 ${from.toUpperCase()} = ${rate.toFixed(4)} ${to.toUpperCase()}_\n_${CONFIG.footer}_`;
}

// ─── Time by city ─────────────────────────────────────────────────────────────
export async function getTime(city) {
  // Use WorldTimeAPI
  const res = await axios.get(`https://worldtimeapi.org/api/timezone`, { timeout: 10000 });
  const timezones = res.data;
  // Find matching timezone
  const match = timezones.find(tz =>
    tz.toLowerCase().includes(city.toLowerCase().replace(' ', '_'))
  );
  if (!match) throw new Error(`Could not find timezone for: ${city}. Try a major city.`);

  const timeRes = await axios.get(`https://worldtimeapi.org/api/timezone/${match}`, { timeout: 10000 });
  const d = timeRes.data;
  const dt = new Date(d.datetime);

  return `🕐 *Time in ${city}*\n\n📅 *Date:* ${dt.toDateString()}\n⏰ *Time:* ${dt.toLocaleTimeString()}\n🌍 *Timezone:* ${match}\n\n_${CONFIG.footer}_`;
}

// ─── Calculator ───────────────────────────────────────────────────────────────
export function calculate(expression) {
  try {
    // Safe eval — only allow math characters
    const safe = expression.replace(/[^0-9+\-*/().\s%^]/g, '');
    if (!safe.trim()) throw new Error('Invalid expression');
    // Replace ^ with ** for exponentiation
    const result = Function(`"use strict"; return (${safe.replace(/\^/g, '**')})`)();
    if (!isFinite(result)) throw new Error('Result is not finite');
    return `🧮 *Calculator*\n\n*${expression}*\n= *${result}*\n\n_${CONFIG.footer}_`;
  } catch {
    throw new Error('Invalid math expression. Example: .calc 25 * 4 + 10');
  }
}

// ─── Fun — jokes, facts, quotes, riddles ─────────────────────────────────────
const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything! 😂",
  "Why did the math book look so sad? Because it had too many problems! 😭📚",
  "I told my wife she was drawing her eyebrows too high. She looked surprised! 😮",
  "Why can't a bicycle stand on its own? Because it's two-tired! 🚲😂",
  "What do you call a fake noodle? An impasta! 🍝",
  "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
  "I'm reading a book about anti-gravity. It's impossible to put down! 📖",
  "Why did the student eat his homework? Because the teacher told him it was a piece of cake! 🎂",
];

const FACTS = [
  "🌍 Kenya is home to the world's fastest runners — more Olympic marathon champions than any other country!",
  "🦒 A giraffe's tongue is about 45cm long and is dark blue-purple to protect it from sunburn!",
  "🧠 Your brain generates about 12-25 watts of electricity — enough to power a small LED bulb!",
  "🌊 The Indian Ocean, which touches Kenya's coast, is the warmest ocean in the world!",
  "🐘 Elephants are the only animals that can't jump — and they're perfectly fine with that! 😄",
  "💧 Kenya's Lake Victoria is the world's largest tropical lake and 2nd largest freshwater lake!",
  "🦋 Butterflies taste with their feet — they have taste sensors on their legs!",
  "⚡ Lightning strikes Earth about 100 times every single second!",
];

const RIDDLES = [
  { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "An echo! 🔊" },
  { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps! 👣" },
  { q: "I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. What am I?", a: "A map! 🗺" },
  { q: "What has hands but can't clap?", a: "A clock! 🕐" },
  { q: "I'm tall when I'm young, short when I'm old. What am I?", a: "A candle! 🕯" },
];

const QUOTES = [
  "💡 *Nelson Mandela:* Education is the most powerful weapon which you can use to change the world.",
  "🌟 *Wangari Maathai:* In the course of history, there comes a time when humanity is called to shift to a new level of consciousness.",
  "🔥 *Muhammad Ali:* Don't count the days, make the days count.",
  "📚 *Chinua Achebe:* Until the lion learns to write, every story will glorify the hunter.",
  "💪 *Oprah Winfrey:* The biggest adventure you can take is to live the life of your dreams.",
  "🚀 *Albert Einstein:* Imagination is more important than knowledge.",
  "🌍 *Barack Obama:* Change will not come if we wait for some other person or some other time.",
];

const TRUTHS = [
  "What is the most embarrassing thing that has ever happened to you?",
  "What is a secret you have never told anyone?",
  "Who do you have a crush on right now?",
  "What is the biggest lie you have ever told?",
  "What is your biggest fear in life?",
];

const DARES = [
  "Send a voice note singing your favourite song for 30 seconds! 🎵",
  "Change your WhatsApp status to 'I love Smiley Cymor Bot' for 1 hour! 😄",
  "Send a funny selfie right now! 📸",
  "Send a voice note saying 'I am the greatest' 3 times! 💪",
  "Text someone 'I miss you' right now! 💬",
];

export const getJoke    = () => JOKES[Math.floor(Math.random() * JOKES.length)];
export const getFact    = () => FACTS[Math.floor(Math.random() * FACTS.length)];
export const getQuote   = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];
export const getRiddle  = () => RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
export const getTruth   = () => TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
export const getDare    = () => DARES[Math.floor(Math.random() * DARES.length)];

export function magicBall(question) {
  const answers = [
    "✅ It is certain!", "✅ Without a doubt!", "✅ Yes, definitely!",
    "✅ You may rely on it.", "🔮 Signs point to yes.", "🔮 Reply hazy, try again.",
    "⚠ Ask again later.", "⚠ Better not tell you now.", "❌ Don't count on it.",
    "❌ My reply is no.", "❌ Very doubtful.", "❌ Outlook not so good.",
  ];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  return `🎱 *Magic 8-Ball*\n\n*Q:* ${question}\n\n*A:* ${answer}\n\n_${CONFIG.footer}_`;
}

export function shipUsers(user1, user2) {
  const pct = Math.floor(Math.random() * 101);
  const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
  const msg = pct >= 80 ? '💖 Perfect match!' : pct >= 60 ? '💕 Great chemistry!' : pct >= 40 ? '😊 Could work!' : pct >= 20 ? '🤔 Needs work...' : '💔 Not a match!';
  return `💕 *Ship Results*\n\n👤 ${user1} + 👤 ${user2}\n\n[${bar}] *${pct}%*\n\n${msg}\n\n_${CONFIG.footer}_`;
}

export function rollDice(sides = 6) {
  const n = parseInt(sides) || 6;
  const result = Math.floor(Math.random() * n) + 1;
  return `🎲 *Dice Roll (d${n})*\n\nYou rolled: *${result}*\n\n_${CONFIG.footer}_`;
}

export function flipCoin() {
  const result = Math.random() < 0.5 ? '🪙 HEADS' : '🪙 TAILS';
  return `🪙 *Coin Flip*\n\nResult: *${result}*\n\n_${CONFIG.footer}_`;
}
