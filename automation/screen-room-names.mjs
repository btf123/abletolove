// Screens member-created room names that fell outside the allow-list.
//
// The app checks a proposed room name against room_words first. Every word on
// the list = 'clean' and it still waits for Brogan, but needs no AI. Any word
// off the list = 'review', and THIS script asks Gemini (via lib/llm.mjs, which
// falls back to Anthropic / Groq) whether the name is safe for a dating
// community for disabled people: not sexual, not hateful, not a dog-whistle,
// not a slur in another language, not impersonation. It writes the verdict
// back and prints a Markdown report the workflow turns into a GitHub issue,
// which is what emails Brogan. He approves or rejects in the Studio.
//
// Env: SUPABASE_URL (optional), SUPABASE_SERVICE_ROLE_KEY (required), plus
// whichever LLM key lib/llm.mjs finds.
import { writeFileSync } from 'node:fs';
import { generateText, llmProvider } from './lib/llm.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgmkughenxaictoqyoop.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY is not set'); process.exit(1); }

const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'return=representation' };

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

function parseVerdict(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const v = String(j.verdict || '').toLowerCase();
    if (v !== 'ok' && v !== 'risky') return null;
    return { verdict: v, reason: String(j.reason || '').slice(0, 240) };
  } catch { return null; }
}

async function screen(room) {
  const prompt = `You moderate room names for Able2Love, a dating and community app for disabled people (UK, 18+). Adult and kink rooms already exist in a separate, verified "After Dark" section, so ANY sexual, explicit, fetish or "hookup" meaning must be flagged risky here. Also flag: hate, slurs (in any language or disguised spelling), dog-whistles, harassment, drugs, scams, impersonation of a brand or person, anything targeting a specific member, or medical misinformation. Ordinary hobbies, places, feelings, disabilities named neutrally, banter and self-deprecating humour are fine.

Proposed room name: "${room.name}"
Proposed description: "${room.descr || ''}"

Reply with ONLY this JSON: {"verdict":"ok"|"risky","reason":"one short sentence"}`;
  const out = await generateText(prompt, { temperature: 0.1 });
  return parseVerdict(out);
}

const pending = await rest(`custom_rooms?status=eq.pending&select=id,name,descr,emoji,name_check,ai_verdict,ai_reason,created_at,created_by&order=created_at.asc`);
console.log(`${pending.length} pending room request(s); llm provider: ${llmProvider() || 'none'}`);

let screened = 0;
for (const room of pending) {
  if (room.ai_verdict) continue;
  if (room.name_check === 'clean') {
    await rest(`custom_rooms?id=eq.${room.id}`, { method: 'PATCH', body: JSON.stringify({ ai_verdict: 'ok', ai_reason: 'Every word is on the allow-list.', screened_at: new Date().toISOString() }) });
    room.ai_verdict = 'ok'; room.ai_reason = 'Every word is on the allow-list.';
    screened++;
    continue;
  }
  let v = null;
  try { v = await screen(room); } catch (e) { console.error('screen failed', room.name, e.message); }
  if (!v) { v = { verdict: 'risky', reason: 'The AI screen could not give a clear answer, so this one is for you.' }; }
  await rest(`custom_rooms?id=eq.${room.id}`, { method: 'PATCH', body: JSON.stringify({ ai_verdict: v.verdict, ai_reason: v.reason, screened_at: new Date().toISOString() }) });
  room.ai_verdict = v.verdict; room.ai_reason = v.reason;
  screened++;
}

// Report for the GitHub issue (which is what emails Brogan).
const lines = [];
if (pending.length) {
  lines.push(`${pending.length} room request${pending.length === 1 ? '' : 's'} waiting for your yes or no.`);
  lines.push('');
  lines.push('Approve or reject them in the Studio: https://able2love.netlify.app/studio/ (Room requests, at the bottom).');
  lines.push('');
  for (const r of pending) {
    const flag = r.ai_verdict === 'risky' ? '🚩 RISKY' : (r.ai_verdict === 'ok' ? '✅ looks fine' : '⏳ not screened');
    lines.push(`- **${r.emoji || '💬'} ${r.name}** ${flag}`);
    if (r.descr) lines.push(`  - "${r.descr}"`);
    if (r.ai_reason) lines.push(`  - ${r.ai_reason}`);
    lines.push(`  - asked ${new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
  }
}
writeFileSync('room-review.md', lines.join('\n'));
writeFileSync('room-review.json', JSON.stringify({ pending: pending.length, screened, risky: pending.filter(r => r.ai_verdict === 'risky').length }));
console.log(lines.join('\n') || 'Nothing waiting.');
