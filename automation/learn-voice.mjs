#!/usr/bin/env node
/**
 * Voice learner. Runs each morning before the brief is written.
 *
 * Reads the founder's "Voice feedback" GitHub issues (filed from the
 * dashboard's Teach-the-bot button: which replies he approved, which he
 * skipped, plus any notes), distils them into standing lessons with Groq,
 * updates social-media-bot/config/voice-lessons.md, and closes the issues.
 *
 * This is how the account's personality learns as it posts: approvals and
 * skips become rules the next drafts obey.
 *
 * Env: GH_TOKEN (workflow token), GROQ_API_KEY. Repo hardcoded (single-tenant).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { generateText } from './lib/llm.mjs';
import { LESSONS_FILE, loadLessons } from './lib/lessons.mjs';

const REPO = 'btf123/abletolove';
const API = `https://api.github.com/repos/${REPO}`;

function gh(pathname, init = {}) {
  return fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function main() {
  if (!process.env.GH_TOKEN) { console.log('No GH_TOKEN; skipping learning.'); return; }

  const res = await gh('/issues?state=open&per_page=50');
  if (!res.ok) { console.log(`Issue list failed (${res.status}); skipping learning.`); return; }
  const issues = (await res.json()).filter(
    (i) => !i.pull_request && /^voice feedback/i.test(i.title || ''),
  );
  if (!issues.length) { console.log('No new voice feedback; lessons unchanged.'); return; }
  console.log(`Found ${issues.length} voice feedback issue(s).`);

  const existing = await loadLessons();
  const feedback = issues
    .map((i) => `--- Feedback filed ${i.created_at?.slice(0, 10)} ---\n${i.body || '(empty)'}`)
    .join('\n\n');

  const prompt = `You maintain the standing voice lessons for Able2Love's social account. The founder reviews drafted replies each day and files feedback: which drafts he APPROVED (they sounded right), which he SKIPPED (they missed his voice), and free-text notes.

CURRENT LESSONS:
${existing.map((l) => `- ${l}`).join('\n') || '(none)'}

NEW FEEDBACK:
${feedback}

Update the lessons. Infer patterns: what approved drafts have in common, what skipped drafts have in common, and anything the notes say directly (notes outrank inference). Merge duplicates, drop lessons the new feedback supersedes, keep every lesson a single concrete writing instruction (what to do or avoid, not a summary of events). Keep the strongest 30 or fewer, most important first. NEVER remove or weaken these four safety lessons: entity voice with no first person; no forced jokes and disability never the punchline or subject of a joke; every reply needs a position; nightlife and venue exclusion stays a core theme.

Return ONLY a JSON array of lesson strings. No markdown, no commentary.`;

  const raw = await generateText(prompt, { temperature: 0.3 });
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = cleaned.indexOf('['); const e = cleaned.lastIndexOf(']');
  if (s === -1 || e === -1) throw new Error('Learner returned no JSON array');
  let lessons = JSON.parse(cleaned.slice(s, e + 1)).map((l) => String(l).trim()).filter(Boolean).slice(0, 30);
  if (lessons.length < 4) { console.log('Learner output too small; keeping existing lessons.'); return; }

  const header = await readFile(LESSONS_FILE, 'utf8').then((t) => t.split(/##\s*Lessons/i)[0]).catch(() => '# Voice lessons\n\n');
  await writeFile(LESSONS_FILE, `${header.trimEnd()}\n\n## Lessons\n\n${lessons.map((l) => `- ${l}`).join('\n')}\n`);
  console.log(`Lessons updated: ${lessons.length} total.`);

  for (const i of issues) {
    await gh(`/issues/${i.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: 'Learned. These preferences are folded into the voice lessons and will shape tomorrow\'s drafts.' }),
    });
    await gh(`/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
  }
  console.log('Feedback issues closed.');
}

main().catch((e) => { console.error('Voice learning failed (non-fatal):', e.message); });
