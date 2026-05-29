// ─── src/modules/elimu.js ────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config.js';
import {
  getElimu, updateElimu, saveElimMsg, getElimHistory,
  clearElimHistory, incElimQuestion, incElimPractice,
  addElimScore, getElimStats,
} from '../database.js';

const client = new Anthropic({ apiKey: CONFIG.anthropicKey });

const SYSTEM_PROMPT = `
You are ELIMU, an expert Kenyan academic tutor built specifically for Kenyan students.
You are NOT an AI assistant — you are a knowledgeable, warm, and encouraging tutor
who has taught in Kenyan schools for 20 years. Never say "I am Claude" or "as an AI".

YOUR PERSONALITY:
- Name: Elimu (never reveal you are Claude)
- Warm, encouraging, uses simple Kenyan English
- Occasionally uses Swahili: "Sawa!", "Vizuri sana!", "Hakuna wasiwasi", "Twende!"
- Motivates students, never shames wrong answers
- Strict about accuracy

KENYAN CURRICULUM:
CBC (Grade 1-9): Literacy, Numeracy, Environmental Activities, Science & Tech,
Social Studies, Mathematics, Integrated Science, Pre-Technical Education,
Business Studies, CRE/IRE, Creative Arts, Agriculture, Home Science

8-4-4 (Form 1-4): English, Kiswahili, Mathematics, Biology, Chemistry, Physics,
History & Government, Geography, CRE/IRE, Business Studies, Computer Studies,
Agriculture, Home Science, Art, Music — KCSE exam at Form 4

KCPE/KCSE: Always reference Kenyan marking schemes and exam styles.

ANSWER FORMAT (always follow this):
📚 *[Subject] | [Grade] | [Topic]*

*Understanding:*
[What the question is asking]

*Step-by-Step Solution:*
[Numbered steps. Show ALL working for maths/science]

*Key Point:*
[One memorable takeaway]

*Kenyan Example:*
[Real Kenyan context example]

PRACTICE FORMAT:
📝 *Practice — [Topic]*
Q1. [easier]
Q2. [same level]  
Q3. [exam style]
*Send your answer to Q1 and I will mark it! ✅*

MARKING FORMAT:
✅ *Marking Your Answer*
*Your Answer:* [repeat]
*Correct Answer:* [full working]
*Score: [X]/10*
*What you got right:* [praise]
*What to improve:* [gentle correction]
*Examiner's tip:* [KCSE/KCPE marking scheme note]

RULES:
- Never answer non-academic questions (say: "Nisamehe! I only help with school subjects 📚")
- Never make up facts
- Keep responses WhatsApp-friendly (use *bold*, not ## headers)
- If student writes Kiswahili, respond in Kiswahili
`;

async function callClaude(messages, maxTokens = 1000) {
  const res = await client.messages.create({
    model:      CONFIG.claudeModel,
    max_tokens: maxTokens,
    system:     SYSTEM_PROMPT,
    messages,
  });
  return res.content[0]?.text || '';
}

export async function elimuAnswer(phone, question) {
  incElimQuestion(phone);
  const student = getElimu(phone);
  const gradeHint = student.grade ? `\n[Student: ${student.grade}, ${student.curriculum} curriculum]` : '';
  saveElimMsg(phone, 'user', question);
  const history = getElimHistory(phone, 8);
  const answer = await callClaude([...history, { role: 'user', content: gradeHint + '\n' + question }]);
  saveElimMsg(phone, 'assistant', answer);
  return answer;
}

export async function elimuPractice(phone, topic) {
  incElimPractice(phone);
  const student = getElimu(phone);
  const gradeHint = student.grade ? `for a ${student.grade} Kenyan student` : 'for a Kenyan student';
  const prompt = `Generate exactly 3 practice questions on "${topic}" ${gradeHint}. Use the practice format exactly.`;
  saveElimMsg(phone, 'user', `[Practice: ${topic}]`);
  const history = getElimHistory(phone, 4);
  const res = await callClaude([...history, { role: 'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  updateElimu(phone, { mode: 'practice', current_topic: topic });
  return res;
}

export async function elimuMark(phone, answer) {
  const student = getElimu(phone);
  const topic = student.current_topic || 'the previous question';
  const prompt = `A student answered: "${answer}" for the topic: "${topic}". Mark it using the marking format.`;
  saveElimMsg(phone, 'user', `[Marking: ${answer}]`);
  const history = getElimHistory(phone, 6);
  const res = await callClaude([...history, { role: 'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  const scoreMatch = res.match(/Score:\s*(\d+)\/10/i);
  if (scoreMatch) addElimScore(phone, parseInt(scoreMatch[1]));
  updateElimu(phone, { mode: 'ask' });
  return res;
}

export async function elimuRevise(phone, topic) {
  const student = getElimu(phone);
  const gradeHint = student.grade ? `for ${student.grade}` : '';
  const prompt = `Give a complete revision summary of "${topic}" ${gradeHint} using the revision format.`;
  saveElimMsg(phone, 'user', `[Revision: ${topic}]`);
  const history = getElimHistory(phone, 4);
  const res = await callClaude([...history, { role: 'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  return res;
}

export async function elimuKcse(phone, subject) {
  const student = getElimu(phone);
  const grade = student.grade || 'Form 4';
  const examType = grade.toLowerCase().includes('form') ? 'KCSE' : 'KCPE';
  const prompt = `Generate one ${examType}-style question in ${subject} for ${grade}. Format like a real ${examType} paper with marks allocation.`;
  saveElimMsg(phone, 'user', `[Exam prep: ${subject}]`);
  const history = getElimHistory(phone, 4);
  const res = await callClaude([...history, { role: 'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  updateElimu(phone, { mode: 'marking', current_topic: subject });
  return res;
}

export async function elimuSolve(phone, problem) {
  incElimQuestion(phone);
  const prompt = `Solve this mathematical/scientific problem step by step for a Kenyan student: "${problem}". Show ALL working clearly. Use the answer format.`;
  saveElimMsg(phone, 'user', `[Solve: ${problem}]`);
  const history = getElimHistory(phone, 4);
  const res = await callClaude([...history, { role: 'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  return res;
}

export function elimuStats(phone) {
  const s = getElimStats(phone);
  const avg = s.total_marked > 0 ? Math.round((s.total_score / s.total_marked) * 10) : 0;
  return `📊 *Your Elimu Progress*\n\n❓ Questions: *${s.questions_asked||0}*\n📝 Practice: *${s.practice_done||0}*\n✅ Marked: *${s.total_marked||0}*\n🏆 Avg Score: *${avg}%*\n\n${avg>=80?'🌟 Excellent!':avg>=60?'👍 Good progress!':avg>=40?'💪 Keep going!':'📚 Practice makes perfect!'}`;
}

export { clearElimHistory, updateElimu, getElimu };
