// ─── src/modules/elimu.js ────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config.js';
import {
  getElimu, updateElimu, saveElimMsg, getElimHistory,
  clearElimHistory, incElimQuestion, incElimPractice,
  addElimScore, getElimStats,
} from '../database.js';

const client = new Anthropic({ apiKey: CONFIG.anthropicKey });

const SYSTEM_PROMPT = `You are ELIMU, an expert Kenyan academic tutor. You are NOT an AI — you are a knowledgeable, warm tutor who has taught in Kenyan schools for 20 years. Never say "I am Claude" or "as an AI". Your name is Elimu.

PERSONALITY: Warm, encouraging, uses simple Kenyan English, occasionally uses Swahili ("Sawa!", "Vizuri sana!", "Twende!"), never shames wrong answers.

KENYAN CURRICULUM:
CBC (Grade 1-9): Literacy, Numeracy, Science & Tech, Social Studies, Mathematics, Integrated Science, Pre-Technical Education, Business Studies, CRE/IRE, Creative Arts, Agriculture
8-4-4 (Form 1-4): English, Kiswahili, Mathematics, Biology, Chemistry, Physics, History & Government, Geography, CRE/IRE, Business Studies, Computer Studies — KCSE exam at Form 4

ANSWER FORMAT:
📚 *[Subject] | [Grade] | [Topic]*
*Understanding:* [what the question asks]
*Step-by-Step Solution:* [numbered steps, show ALL working]
*Key Point:* [one memorable takeaway]
*Kenyan Example:* [real Kenyan context]

MARKING FORMAT:
✅ *Marking Your Answer*
*Your Answer:* [repeat] | *Correct Answer:* [full working]
*Score: [X]/10* | *What you got right:* [praise] | *What to improve:* [gentle correction]
*Examiner tip:* [KCSE/KCPE marking note]

RULES: Never answer non-academic questions. Keep responses WhatsApp-friendly. Use *bold* not ## headers.`;

async function callClaude(messages, maxTokens = 1000) {
  const res = await client.messages.create({
    model: CONFIG.claudeModel, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages,
  });
  return res.content[0]?.text || '';
}

export async function elimuAnswer(phone, question) {
  incElimQuestion(phone);
  const student   = getElimu(phone);
  const gradeHint = student.grade ? `\n[Student: ${student.grade}, ${student.curriculum} curriculum]` : '';
  saveElimMsg(phone, 'user', question);
  const answer = await callClaude([...getElimHistory(phone, 8), { role:'user', content: gradeHint+'\n'+question }]);
  saveElimMsg(phone, 'assistant', answer);
  return answer;
}

export async function elimuPractice(phone, topic) {
  incElimPractice(phone);
  const student   = getElimu(phone);
  const gradeHint = student.grade ? `for a ${student.grade} Kenyan student` : 'for a Kenyan student';
  const prompt    = `Generate exactly 3 practice questions on "${topic}" ${gradeHint}. Number them Q1, Q2, Q3. End with "Send your answer to Q1 and I will mark it! ✅"`;
  saveElimMsg(phone, 'user', `[Practice: ${topic}]`);
  const res = await callClaude([...getElimHistory(phone, 4), { role:'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  updateElimu(phone, { mode:'practice', current_topic: topic });
  return res;
}

export async function elimuMark(phone, answer) {
  const student = getElimu(phone);
  const topic   = student.current_topic || 'the previous question';
  const prompt  = `A student answered: "${answer}" for topic: "${topic}". Mark it with score out of 10 and detailed feedback using the marking format.`;
  saveElimMsg(phone, 'user', `[Marking: ${answer}]`);
  const res = await callClaude([...getElimHistory(phone, 6), { role:'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  const scoreMatch = res.match(/Score:\s*(\d+)\/10/i);
  if (scoreMatch) addElimScore(phone, parseInt(scoreMatch[1]));
  updateElimu(phone, { mode:'ask' });
  return res;
}

export async function elimuRevise(phone, topic) {
  const student   = getElimu(phone);
  const gradeHint = student.grade ? `for ${student.grade}` : '';
  const prompt    = `Give a complete revision summary of "${topic}" ${gradeHint}. Include: definition, key formula/rule, common mistakes, must-remember points, and past exam style.`;
  saveElimMsg(phone, 'user', `[Revision: ${topic}]`);
  const res = await callClaude([...getElimHistory(phone, 4), { role:'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  return res;
}

export async function elimuKcse(phone, subject) {
  const student  = getElimu(phone);
  const grade    = student.grade || 'Form 4';
  const examType = grade.toLowerCase().includes('form') ? 'KCSE' : 'KCPE';
  const prompt   = `Generate one ${examType}-style question in ${subject} for ${grade} with marks allocation.`;
  saveElimMsg(phone, 'user', `[Exam prep: ${subject}]`);
  const res = await callClaude([...getElimHistory(phone, 4), { role:'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  updateElimu(phone, { mode:'marking', current_topic: subject });
  return res;
}

export async function elimuSolve(phone, problem) {
  incElimQuestion(phone);
  const prompt = `Solve this problem step by step for a Kenyan student: "${problem}". Show ALL working clearly.`;
  saveElimMsg(phone, 'user', `[Solve: ${problem}]`);
  const res = await callClaude([...getElimHistory(phone, 4), { role:'user', content: prompt }]);
  saveElimMsg(phone, 'assistant', res);
  return res;
}

export function elimuStats(phone) {
  const s   = getElimStats(phone);
  const avg = s.total_marked > 0 ? Math.round((s.total_score / s.total_marked) * 10) : 0;
  return `📊 *Your Elimu Progress*\n\n❓ Questions: *${s.questions_asked||0}*\n📝 Practice: *${s.practice_done||0}*\n✅ Marked: *${s.total_marked||0}*\n🏆 Avg Score: *${avg}%*\n\n${avg>=80?'🌟 Excellent!':avg>=60?'👍 Good progress!':avg>=40?'💪 Keep going!':'📚 Practice makes perfect!'}`;
}

export { clearElimHistory, updateElimu, getElimu };
