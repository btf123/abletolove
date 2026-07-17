#!/usr/bin/env node
/**
 * Able2Love Instagram DM responder (support bot, inbound only).
 *
 * Polls the account's Instagram DM conversations and replies to new inbound
 * messages using the narrow support persona in dm-bot/persona.md and the facts
 * in dm-bot/knowledge.md. It answers plain app-support questions and ESCALATES
 * everything else (personal, emotional, sexual, safety, under-18, legal/medical,
 * and especially any sign of distress) to Brogan, never improvising.
 *
 * ACTIVATION GATE: Instagram only allows messaging the general public via the
 * API with Advanced Access to instagram_business_manage_messages, which needs
 * App Review + business verification + the app in Live mode. Until then this
 * script runs but the messaging calls will be refused by the API; it fails
 * gracefully and posts nothing. It is staged and ready for when review passes.
 *
 * SAFETY: kill switch (DM_REPLIES must be "on"), ledger (never answer the same
 * message twice), per-run cap, and the persona's hard escalation + crisis
 * rails. --dry-run reads and drafts but sends nothing.
 *
 * Env: IG_USER_ID, IG_ACCESS_TOKEN, ANTHROPIC_API_KEY or GROQ_API_KEY,
 *      GH_TOKEN (to flag escalations/crises for Brogan).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText } from './lib/llm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(ROOT, 'content-queue/dm-log.json');
const GRAPH = process.env.IG_GRAPH_BASE || 'https://graph.instagram.com/v21.0';
const REPO = 'btf123/abletolove';
const MAX_REPLIES = 12;

async function ig(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${pathAndQuery}${sep}access_token=${encodeURIComponent(process.env.IG_ACCESS_TOKEN)}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`IG GET ${pathAndQuery.split('?')[0]} failed ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

async function sendMessage(recipientId, text) {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, access_token: process.env.IG_ACCESS_TOKEN }),
  });
  if (!res.ok) throw new Error(`IG send failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

async function flagForBrogan(title, lines) {
  if (!process.env.GH_TOKEN || !lines.length) return;
  try {
    await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: ['These Instagram DMs were escalated by the assistant and need you. It did not answer them itself.', '', ...lines.map((l) => `- ${l}`)].join('\n') }),
    });
  } catch (e) { console.warn(`Could not file flag issue: ${e.message.slice(0, 100)}`); }
}

function parseJson(raw) {
  const c = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = c.indexOf('{'); const e = c.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON in model output');
  return JSON.parse(c.slice(s, e + 1));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.IG_USER_ID || !process.env.IG_ACCESS_TOKEN) { console.log('No Instagram credentials; nothing to do.'); return; }
  if (!dryRun && process.env.DM_REPLIES !== 'on') { console.log('DM_REPLIES is not "on"; doing nothing. (Kill switch working.)'); return; }

  const persona = await readFile(path.join(ROOT, 'dm-bot/persona.md'), 'utf8');
  const knowledge = await readFile(path.join(ROOT, 'dm-bot/knowledge.md'), 'utf8');

  let ledger = [];
  try { ledger = JSON.parse(await readFile(LEDGER, 'utf8')); } catch { /* first run */ }
  const seen = new Set(ledger.map((e) => e.id));

  // Pull recent conversations and their latest inbound messages. If the API
  // refuses (messaging permission not granted yet), stop cleanly.
  let convos;
  try {
    convos = await ig('me/conversations?platform=instagram&fields=participants,messages.limit(5){id,from,message,created_time}&limit=25');
  } catch (e) {
    console.log(`Messaging API not available yet (${e.message.slice(0, 120)}). This activates after Instagram App Review. Nothing sent.`);
    return;
  }

  const meId = String(process.env.IG_USER_ID);
  const pending = [];
  for (const c of convos.data || []) {
    const msgs = (c.messages?.data || []).slice().reverse(); // oldest first
    const last = msgs[msgs.length - 1];
    if (!last || !last.message) continue;
    const fromId = String(last.from?.id || '');
    if (fromId === meId || seen.has(last.id)) continue; // our own last message, or already handled
    pending.push({ id: last.id, senderId: fromId, text: last.message });
  }
  if (!pending.length) { console.log('No new inbound DMs to handle.'); return; }
  const batch = pending.slice(0, MAX_REPLIES);
  console.log(`Found ${pending.length} new DM(s); handling up to ${batch.length}.`);

  let sent = 0; const flags = []; const handled = [];
  for (const m of batch) {
    const prompt = `${persona}\n\nKNOWLEDGE BASE:\n${knowledge}\n\nA user has sent this Instagram DM:\n"""${m.text}"""\n\nFollow your rails exactly. Return the strict JSON contract.`;
    let decision;
    try { decision = parseJson(await generateText(prompt, { temperature: 0.3 })); }
    catch (e) { console.warn(`draft failed for ${m.id}: ${e.message.slice(0, 80)}`); continue; }
    handled.push(m.id);
    const reply = String(decision.reply || '').split('—').join(', ').split('–').join(', ').trim();
    const escalated = decision.escalate === true || decision.category === 'crisis' || decision.category === 'escalate';
    if (escalated) flags.push(`"${m.text.slice(0, 140)}" (${decision.category || 'escalate'})`);
    if (!reply) { continue; }
    if (dryRun) { console.log(`DRY: would reply (${decision.category}) -> ${reply}`); sent++; continue; }
    try { await sendMessage(m.senderId, reply); sent++; }
    catch (e) { console.error(`send failed for ${m.id}: ${e.message}`); handled.pop(); }
  }

  const now = new Date().toISOString();
  for (const id of handled) ledger.push({ id, at: now });
  await mkdir(path.dirname(LEDGER), { recursive: true });
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));

  if (!dryRun && flags.length) await flagForBrogan(`Instagram DMs needing you (${now.slice(0, 10)})`, flags);
  console.log(`Done. Sent ${sent}, escalated ${flags.length} to Brogan.`);
}

main().catch((e) => { console.error('DM responder failed:', e.message); process.exit(1); });
