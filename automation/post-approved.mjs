#!/usr/bin/env node
/**
 * Post the founder-approved outreach replies to X, by official API.
 *
 * The dashboard's yes/no buttons write content-queue/outreach/approved-<date>.json
 * and dispatch this. Each entry was individually approved by the founder; that
 * approval is the safety. This script adds the mechanical guardrails:
 *  - AUTOPOST kill switch honoured (global off switch).
 *  - Ledger (replied-log.json): never reply to the same post twice, ever.
 *  - Text guardrails at post time (banned words, dashes, length).
 *  - Cap per run, with a human-paced random gap between replies.
 *
 * Env: X keys, APPROVED_DATE (YYYY-MM-DD, defaults to today).
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postToX } from './lib/x-post.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'content-queue/outreach');
const LEDGER = path.join(OUT_DIR, 'replied-log.json');
const MAX_PER_RUN = 15;

const DEFAULT_BANNED = ['suffers from', 'wheelchair-bound', 'special needs', 'differently abled', 'inspirational'];

async function main() {
  if (process.env.AUTOPOST !== 'on') { console.log('AUTOPOST is not "on"; doing nothing. (Kill switch.)'); return; }
  const date = process.env.APPROVED_DATE || new Date().toISOString().slice(0, 10);
  const file = path.join(OUT_DIR, `approved-${date}.json`);

  let approved;
  try { approved = JSON.parse(await readFile(file, 'utf8')).approvals || []; }
  catch { console.log(`No approvals file for ${date}; nothing to post.`); return; }

  let niche = {};
  try { niche = JSON.parse(await readFile(path.join(ROOT, 'social-media-bot/config/abletolove.niche.json'), 'utf8')); } catch { /* defaults */ }
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  let ledger = [];
  try { ledger = JSON.parse(await readFile(LEDGER, 'utf8')); } catch { /* first run */ }
  const done = new Set(ledger.map((e) => e.id));

  let posted = 0; let skipped = 0;
  for (const a of approved.slice(0, MAX_PER_RUN)) {
    const id = String(a.id || '').trim();
    const text = String(a.reply || '').trim();
    if (!id || !text) { skipped++; continue; }
    if (done.has(id)) { console.log(`Already replied to ${id}; skipping.`); skipped++; continue; }
    const hay = text.toLowerCase();
    const trip = banned.find((p) => hay.includes(p.toLowerCase())) || (/[—–]/.test(text) ? 'dash' : null) || (text.length > 280 ? 'length' : null);
    if (trip) { console.log(`Guardrail (${trip}) blocked reply to ${id}; skipping.`); skipped++; continue; }

    try {
      const newId = await postToX({ text, replyToId: id });
      ledger.push({ id, date, reply: text, posted: newId });
      done.add(id);
      posted++;
      console.log(`Replied to ${id} -> ${newId}`);
    } catch (e) {
      console.error(`Reply to ${id} failed: ${e.message.slice(0, 200)}`);
      ledger.push({ id, date, reply: text, posted: `FAILED: ${e.message.slice(0, 120)}` });
    }
    // Human pacing: 20 to 70 seconds between replies, never a burst.
    if (posted + skipped < approved.length) {
      await new Promise((r) => setTimeout(r, 20000 + Math.floor(Math.random() * 50000)));
    }
  }

  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));
  console.log(`Done: ${posted} posted, ${skipped} skipped.`);
}

main().catch((e) => { console.error('Posting approved replies failed:', e.message); process.exit(1); });
