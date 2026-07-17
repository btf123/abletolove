#!/usr/bin/env node
/**
 * Able2Love Instagram engagement responder (comments on your own posts).
 *
 * Replying to comments on your OWN posts is sanctioned, ban-safe engagement and
 * one of the real growth levers. This reads recent comments on the account's own
 * media and replies in the app's voice, with hard safety rails.
 *
 * SAFETY DESIGN (in order of importance):
 *  - Official Instagram API only (graph.instagram.com), own posts only.
 *  - Kill switch: does nothing unless ENGAGE_REPLIES is exactly "on".
 *  - Ledger: content-queue/engaged-log.json records every comment handled; a
 *    comment already in the ledger is never replied to twice.
 *  - Per-run cap: never more than MAX_REPLIES replies in a single run.
 *  - Hard rails: anything personal, emotional, hostile, sexual, about health or
 *    another user, or any sign of distress is SKIPPED (never argued with), and
 *    flagged for Brogan. Crisis is never engaged, only flagged.
 *  - Never replies to its own comments.
 *  - Dry run (--dry-run) reads and drafts but posts nothing.
 *
 * Env: IG_USER_ID, IG_ACCESS_TOKEN, ANTHROPIC_API_KEY or GROQ_API_KEY (voice),
 *      GH_TOKEN (optional, to file a flag issue for skipped/sensitive comments).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText } from './lib/llm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(ROOT, 'content-queue/engaged-log.json');
const GRAPH = process.env.IG_GRAPH_BASE || 'https://graph.instagram.com/v21.0';
const REPO = 'btf123/abletolove';

const MAX_REPLIES = 15;        // hard cap per run, keeps it human-paced
const MEDIA_TO_SCAN = 12;      // most recent posts to check for new comments
const BANNED_CHARACTERS = ['—', '–'];

function scrub(text) {
  let t = String(text || '');
  for (const ch of BANNED_CHARACTERS) t = t.split(ch).join(', ');
  return t.trim();
}

async function ig(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${pathAndQuery}${sep}access_token=${encodeURIComponent(process.env.IG_ACCESS_TOKEN)}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`IG GET ${pathAndQuery.split('?')[0]} failed ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

async function replyToComment(commentId, message) {
  const res = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: process.env.IG_ACCESS_TOKEN }),
  });
  if (!res.ok) throw new Error(`IG reply failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).id;
}

function buildPrompt(ourUsername, items) {
  const list = items.map((c, i) => `[${i}] @${c.username}: ${c.text}`).join('\n');
  return `You handle replies to comments on Able2Love's own Instagram posts. Able2Love is a dating app for disabled and non-disabled people, built by Brogan (a Manchester wheelchair user). The voice: warm, dry, plain-spoken UK English, a real person with a position, never corporate, never pity or inspiration language, no em dashes. Replies are SHORT (one or two sentences), friendly, and where it fits invite a bit more conversation. Celebrate people who get it. Never argue.

For EACH comment decide an action:
- "reply": a normal, friendly comment (a compliment, a laugh, agreement, a light question, someone tagging a mate). Write a short reply in the voice.
- "skip": anything you should not auto-reply to. This includes: anything personal, emotional, about someone's own relationship, body, health or care; anything sexual or flirtatious; hostility, trolling or bait; reports about another user or harassment; anyone who seems to think they are messaging a match or a person; anyone who might be under 18; legal, medical, money or account requests. Do NOT write a reply for these; they go to Brogan.
- "crisis": any sign of distress, hopelessness, self-harm or danger. Do NOT engage. These are flagged to Brogan.

Never invent features, prices, dates or numbers. Never make disability the punchline. When unsure, choose "skip".

COMMENTS:
${list}

Return STRICT JSON only: {"decisions":[{"i":<index>,"action":"reply|skip|crisis","reply":"<text if action is reply, else empty>"}]}. One entry per comment index above.`;
}

function parseJson(raw) {
  const c = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = c.indexOf('{'); const e = c.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON in model output');
  return JSON.parse(c.slice(s, e + 1));
}

async function flagForBrogan(lines) {
  if (!process.env.GH_TOKEN || !lines.length) return;
  const body = ['These Instagram comments were skipped by the responder and need your eyes (sensitive, hostile, or a person in distress). The bot did not reply to any of them.', '', ...lines.map((l) => `- ${l}`)].join('\n');
  try {
    await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Instagram comments needing your eyes (${new Date().toISOString().slice(0, 10)})`, body }),
    });
  } catch (e) { console.warn(`Could not file flag issue: ${e.message.slice(0, 100)}`); }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.IG_USER_ID || !process.env.IG_ACCESS_TOKEN) {
    console.log('No Instagram credentials; nothing to do.');
    return;
  }
  if (!dryRun && process.env.ENGAGE_REPLIES !== 'on') {
    console.log('ENGAGE_REPLIES is not "on"; doing nothing. (Kill switch working.)');
    return;
  }

  const me = await ig(`${process.env.IG_USER_ID}?fields=username`);
  const ourUsername = (me.username || '').toLowerCase();

  let ledger = [];
  try { ledger = JSON.parse(await readFile(LEDGER, 'utf8')); } catch { /* first run */ }
  const seen = new Set(ledger.map((e) => e.id));

  // Gather new comments across recent media.
  const media = await ig(`${process.env.IG_USER_ID}/media?fields=id&limit=${MEDIA_TO_SCAN}`);
  const fresh = [];
  for (const m of media.data || []) {
    let comments;
    try { comments = await ig(`${m.id}/comments?fields=id,text,username,timestamp&limit=50`); }
    catch (e) { console.warn(`comments for ${m.id}: ${e.message.slice(0, 100)}`); continue; }
    for (const c of comments.data || []) {
      if (!c.text || seen.has(c.id)) continue;
      if ((c.username || '').toLowerCase() === ourUsername) continue; // never our own
      fresh.push({ id: c.id, text: c.text, username: c.username || 'someone' });
    }
  }
  if (!fresh.length) { console.log('No new comments to handle.'); return; }
  const batch = fresh.slice(0, MAX_REPLIES);
  console.log(`Found ${fresh.length} new comment(s); handling up to ${batch.length}.`);

  const data = parseJson(await generateText(buildPrompt(ourUsername, batch), { temperature: 0.7 }));
  const decisions = new Map((data.decisions || []).map((d) => [d.i, d]));

  let replied = 0; const flags = []; const handledIds = [];
  for (let i = 0; i < batch.length; i++) {
    const c = batch[i];
    const d = decisions.get(i) || { action: 'skip' };
    handledIds.push(c.id); // handled either way, so we don't re-process
    if (d.action === 'reply' && scrub(d.reply)) {
      const message = scrub(d.reply);
      if (dryRun) { console.log(`DRY: would reply to @${c.username} ("${c.text.slice(0, 40)}") -> ${message}`); replied++; continue; }
      try { await replyToComment(c.id, message); console.log(`Replied to @${c.username}.`); replied++; }
      catch (e) { console.error(`Reply failed for ${c.id}: ${e.message}`); handledIds.pop(); /* let it retry next run */ }
    } else {
      flags.push(`@${c.username}: "${c.text.slice(0, 120)}" (${d.action === 'crisis' ? 'possible distress' : 'sensitive'})`);
    }
  }

  // Record handled comments so they are never touched again.
  const now = new Date().toISOString();
  for (const id of handledIds) ledger.push({ id, at: now });
  await mkdir(path.dirname(LEDGER), { recursive: true });
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));

  if (!dryRun) await flagForBrogan(flags);
  console.log(`Done. Replied ${replied}, flagged ${flags.length} for Brogan.`);
}

main().catch((e) => { console.error('Engagement responder failed:', e.message); process.exit(1); });
