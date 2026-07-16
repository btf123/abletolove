#!/usr/bin/env node
/**
 * Test the DM assistant's brain from your terminal before it goes live.
 * Sends a sample message through the same rails + knowledge the live bot uses
 * and prints its JSON verdict, so you can check it answers and escalates right.
 *
 * Usage:
 *   GROQ_API_KEY=... node dm-bot/test-brain.mjs "how do I sign up?"
 *   GROQ_API_KEY=... node dm-bot/test-brain.mjs "are you a real person?"
 *   GROQ_API_KEY=... node dm-bot/test-brain.mjs "i feel really hopeless"
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const text = process.argv.slice(2).join(' ').trim();
  if (!text) { console.error('Give a message to test, e.g. node dm-bot/test-brain.mjs "what does it cost?"'); process.exit(1); }
  const key = process.env.GROQ_API_KEY;
  if (!key) { console.error('Set GROQ_API_KEY to test.'); process.exit(1); }

  const persona = await readFile(path.join(DIR, 'persona.md'), 'utf8');
  const knowledge = await readFile(path.join(DIR, 'knowledge.md'), 'utf8');
  const prompt = `${persona}\n\nKNOWLEDGE:\n${knowledge}\n\nUser message: ${JSON.stringify(text)}\n\nReturn only the JSON described in the output contract.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) { console.error(`Groq HTTP ${res.status}: ${await res.text()}`); process.exit(1); }
  const data = await res.json();
  const out = data.choices?.[0]?.message?.content || '{}';
  console.log(`\nMESSAGE: ${text}\n`);
  try { console.log(JSON.stringify(JSON.parse(out), null, 2)); }
  catch { console.log(out); }
}

main().catch((e) => { console.error(e); process.exit(1); });
