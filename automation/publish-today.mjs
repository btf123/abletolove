#!/usr/bin/env node
/**
 * Able2Love auto-publisher.
 *
 * Once a day, posts today's planned content to X and Instagram through the
 * platforms' OFFICIAL APIs (the sanctioned way; this is what keeps the
 * accounts safe). Reads the newest content-queue/week-YYYY-MM-DD/week.json,
 * works out which day today is, and publishes that day's pair.
 *
 * SAFETY DESIGN (in order of importance):
 *  - Official APIs only. No scraping, no session cookies, no browser puppets.
 *  - Kill switch: exits unless the AUTOPOST env/repo variable is exactly "on".
 *  - Hard cap: one post per platform per run; the workflow runs once a day.
 *  - Ledger: content-queue/posted-log.json records every publish; a day that
 *    is already in the ledger can never post twice.
 *  - Guardrails re-checked at post time (banned words, dashes, length), not
 *    just at generation time.
 *  - Per-day "hold": set "hold": true on a day in week.json and the
 *    publisher skips it and says so (used e.g. for See Me First until fixed).
 *  - Any failure opens a loud GitHub issue rather than failing silently.
 *
 * Usage:  node automation/publish-today.mjs            (real run)
 *         node automation/publish-today.mjs --dry-run  (say what it would do)
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postToX } from './lib/x-post.mjs';
import { postToInstagram } from './lib/ig-post.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, 'content-queue');
const LEDGER = path.join(QUEUE, 'posted-log.json');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const RAW_BASE = 'https://raw.githubusercontent.com/btf123/abletolove/main';

const DEFAULT_BANNED = [
  'suffers from', 'afflicted', 'confined to a wheelchair', 'wheelchair-bound',
  'special needs', 'differently abled', 'handicapable', 'overcame',
  'despite her disability', 'despite his disability', 'despite their disability',
  'inspiring us all', 'brave', 'passionate', 'empowering', 'transformative',
  'inspirational', 'journey to love',
];
const BANNED_CHARACTERS = ['—', '–'];

function fail(msg) { console.error(`PUBLISHER: ${msg}`); process.exit(1); }

function guardrail(text, banned) {
  const hay = text.toLowerCase();
  for (const p of banned) if (hay.includes(p.toLowerCase())) return `banned phrase "${p}"`;
  for (const ch of BANNED_CHARACTERS) if (text.includes(ch)) return 'em/en dash';
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Kill switch: nothing happens unless explicitly switched on.
  if (!dryRun && process.env.AUTOPOST !== 'on') {
    console.log('AUTOPOST is not "on"; doing nothing. (This is the kill switch working.)');
    return;
  }

  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  // Pick the batch that actually covers TODAY. Newest first, but a batch that
  // is unreleased (approved:false) or starts in the future must never block an
  // older, released batch from finishing its remaining days.
  const dirs = (await readdir(QUEUE, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^week-\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name).sort();
  if (!dirs.length) { console.log('No dated week folders yet; nothing to publish.'); return; }

  const today = new Date().toISOString().slice(0, 10);
  let weekDir = null; let week = null; let dayIndex = -1;
  for (const dir of dirs.slice().reverse()) {
    let w;
    try { w = JSON.parse(await readFile(path.join(QUEUE, dir, 'week.json'), 'utf8')); }
    catch { console.log(`${dir} has no week.json; skipping it.`); continue; }
    if (w.approved === false) { console.log(`${dir} is waiting for your Release; looking past it.`); continue; }
    const idx = Math.round((Date.parse(today) - Date.parse(w.start)) / 86400000);
    if (idx < 0) { console.log(`${dir} starts ${w.start}, not yet; looking past it.`); continue; }
    if (idx >= (w.days || []).length) { continue; } // that week is finished
    weekDir = dir; week = w; dayIndex = idx; break;
  }
  if (!week) { console.log('No released batch covers today; nothing to publish. (Release a batch to resume.)'); return; }
  const day = week.days[dayIndex];

  // Ledger: never post the same day twice.
  let ledger = [];
  try { ledger = JSON.parse(await readFile(LEDGER, 'utf8')); } catch { /* first run */ }
  const key = `${weekDir}/day-${day.day}`;
  if (ledger.some((e) => e.key === key)) { console.log(`${key} already posted; refusing to double-post.`); return; }

  if (day.hold) { console.log(`${key} is marked "hold": skipping on purpose.`); return; }

  // Guardrails at the moment of truth.
  for (const [label, text] of [['X', day.x], ['Instagram', day.instagram]]) {
    const v = guardrail(text, banned);
    if (v) fail(`${label} text for ${key} tripped a guardrail (${v}); not posting. Fix week.json and re-run.`);
  }
  if (day.x.length > 280) fail(`X text for ${key} is ${day.x.length} chars (max 280); not posting.`);

  const cardUrl = `${RAW_BASE}/content-queue/${weekDir}/${day.card}`;

  if (dryRun) {
    console.log(`DRY RUN. Would post ${key}:`);
    console.log(`  X (${day.x.length} chars): ${day.x.slice(0, 80)}...`);
    console.log(`  IG: ${day.instagram.slice(0, 80)}...`);
    console.log(`  image: ${cardUrl}`);
    return;
  }

  // Only touch a platform whose keys are actually set. This lets you switch
  // on X alone (or Instagram alone) without the other going red.
  const hasX = process.env.X_API_KEY && process.env.X_API_SECRET
    && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_SECRET;
  const hasIG = process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN;
  if (!hasX && !hasIG) {
    console.log('No platform keys set (X or Instagram); nothing to post. Add the secrets to go live.');
    return;
  }

  // Anti-bot-pattern: never post on the exact same second every day. Wait a
  // random slice of time first, so posts look human, not machine-timed.
  // (GitHub cron is already loosely timed; this adds more natural scatter.)
  if (process.env.NO_JITTER !== '1') {
    const jitterMs = Math.floor(Math.random() * 22 * 60 * 1000); // 0 to 22 minutes
    console.log(`Human-like delay: waiting ${Math.round(jitterMs / 60000)} min before posting.`);
    await new Promise((r) => setTimeout(r, jitterMs));
  }

  const results = { key, date: today, x: null, instagram: null };

  // X (image uploaded as bytes).
  if (hasX) {
    try {
      const imgRes = await fetch(cardUrl);
      if (!imgRes.ok) throw new Error(`card fetch ${imgRes.status}`);
      const bytes = Buffer.from(await imgRes.arrayBuffer());
      results.x = await postToX({ text: day.x, imageBytes: bytes, altText: day.alt });
      console.log(`X posted: ${results.x}`);
    } catch (e) {
      results.x = `FAILED: ${e.message}`;
      console.error(`X failed: ${e.message}`);
    }
  } else {
    results.x = 'skipped (no X keys)';
    console.log('X keys not set; skipping X.');
  }

  // Instagram (image by public URL).
  if (hasIG) {
    try {
      results.instagram = await postToInstagram({ imageUrl: cardUrl, caption: day.instagram });
      console.log(`Instagram posted: ${results.instagram}`);
    } catch (e) {
      results.instagram = `FAILED: ${e.message}`;
      console.error(`Instagram failed: ${e.message}`);
    }
  } else {
    results.instagram = 'skipped (no Instagram keys)';
    console.log('Instagram keys not set; skipping Instagram.');
  }

  ledger.push(results);
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));

  const failed = [results.x, results.instagram].some((r) => String(r).startsWith('FAILED'));
  if (failed) {
    // Non-zero exit makes the workflow red and triggers the alert issue.
    fail(`A configured platform failed for ${key}. Ledger updated; see logs.`);
  }
}

main().catch((e) => fail(e.message));
