#!/usr/bin/env node
/**
 * Able2Love daily outreach brief.
 *
 * Every morning this robot hunts the live web (Gemini + Google Search
 * grounding, free tier) for: fresh conversations worth joining, an outreach
 * target of the day, funding/press opportunities, and trending moments. It
 * drafts comments and DMs in the founder's voice and files a brief.
 *
 * IT NEVER POSTS. A human (or the Claude extension under human review) sends
 * the approved drafts. Auto-posted replies get accounts banned and voices
 * go off-brand; the hunt is automated, the hand is human.
 *
 * Usage:
 *   GEMINI_API_KEY=... node automation/generate-outreach.mjs
 *   node automation/generate-outreach.mjs --dry-run
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue/outreach');
// Try in order until one has free-tier quota; Google retires models from the
// free tier over time, so a chain beats a hardcoded name.
const MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

const DEFAULT_BANNED = [
  'suffers from', 'afflicted', 'confined to a wheelchair', 'wheelchair-bound',
  'special needs', 'differently abled', 'handicapable', 'overcame',
  'despite her disability', 'despite his disability', 'despite their disability',
  'inspiring us all', 'brave', 'passionate', 'empowering', 'transformative',
  'inspirational', 'journey to love',
];
const BANNED_CHARACTERS = ['—', '–'];

// The rotating outreach rota: one priority target per day. Engage-first.
const ROTA = [
  'Squirmy and Grubs (Shane and Hannah Burcaw, interabled couple YouTube)',
  'Samantha Renke (UK wheelchair user, actress, The Lifestyle Pod)',
  'Jessica Kellgren-Fozard (UK deaf/disabled YouTuber, relationships content)',
  'Tasha Ghouri (UK deaf Love Island star)',
  'Andrew Gurza (Disability After Dark podcast, disability and intimacy)',
  'Molly Burke (blind creator, global reach)',
  'Lucy Edwards (UK blind creator)',
  'Roll with Cole and Charisma (interabled couple)',
  'Shani Dhanda (UK disability activist and broadcaster)',
  'Martyn Sibley (Disability Horizons co-founder, disabled entrepreneur)',
  'Zach Anner (comedian with cerebral palsy)',
  'Amy Pohl (UK chronic illness TikTok)',
  'Gem Hubbard, Wheels No Heels (UK wheelchair lifestyle)',
  'Sophie Morgan (UK TV presenter, wheelchair user)',
  'Euan’s Guide (accessible venue reviews, partnership angle)',
  'BBC Access All podcast (press angle: Manchester comedian founder story)',
];

function dayOfYear(d) {
  return Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 0))) / 86400000);
}

function findViolation(text, banned) {
  const hay = text.toLowerCase();
  for (const p of banned) if (hay.includes(p.toLowerCase())) return p;
  return null;
}

function buildPrompt(niche, target, dateStr) {
  const tone = niche.content_tone || 'direct, human and dryly funny';
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  return `You are the outreach scout for Able2Love, a live dating app (free on Google Play) for disabled and non-disabled people open to dating one another. You write in the founder's voice: a Greater Manchester comedy writer, performer and full-time wheelchair user. Performer first. Dry humour, UK English, no em or en dashes ever, no pity framing, no invented facts. The only product claims allowed: the app exists, it is free on Google Play, and what it stands for (access needs up front, disclosure on your terms, accessible venue planning, See Me First profiles).

Today is ${dateStr}. USE YOUR SEARCH TOOL for every section. Search the live web for CURRENT items from the last 1 to 3 days. UK first, but global always. Do not invent posts, people, deadlines or links; if search gives you nothing for a section, say so plainly.

Produce a markdown brief with exactly these sections:

## Conversations to join today
Find 8 to 12 FRESH items (last 72 hours): news stories, viral threads, X posts, Instagram posts or Reddit threads about any of: disability and dating, dating app frustrations, accessibility fails or wins, chronic illness dating, deaf dating, interabled couples, disability pride. For each item give:
- What and where it is (platform, who posted, link if the search result gives one)
- A drafted reply IN THE FOUNDER'S VOICE. It must be a genuine reaction first (agree, add an experience, make the dry joke, answer the question). Mention the app ONLY if it truly belongs, and never as "check out my app" or a link drop. Many replies should not mention the app at all. 1 to 3 sentences each.

## Outreach target of the day: ${target}
Search what this person or organisation posted or was in the news for THIS WEEK. Then draft ONE engagement move: a reply to something specific and recent of theirs (preferred), or if they posted nothing recent, a short warm DM that references their actual work. Genuine first, no ask unless the relationship warrants a soft one.

## Funding and opportunity watch
Search for currently open or newly announced: grants for disabled entrepreneurs UK, social enterprise funding, accessible tech awards, startup competitions, press callouts for disabled founders (#JournoRequest), podcast guest callouts. List anything OPEN now with its deadline. If nothing new today, say "Nothing new today" and list the evergreen leads (UnLtd rolling awards; Access to Work; Stelios Awards next window around March).

## Moment watch
Any awareness day, trending hashtag or big cultural moment TODAY or in the next 7 days the brand can join honestly. One line each on how.

Rules for every drafted word: never use these phrases: ${banned}. Never praise non-disabled people merely for dating a disabled person. Never make disabled bodies, care needs or trauma the punchline. Tone: ${tone}. Direct beats padded.`;
}

async function callGeminiWithSearch(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY is not set (see marketing/07-free-bot.md).');
    process.exit(1);
  }
  let lastError;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.7 },
          }),
        });
        if (res.status === 429 || res.status === 404) {
          // Out of quota or model gone: no point retrying this model, move on.
          throw Object.assign(new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`), { skipModel: true });
        }
        if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (!text) throw new Error(`Gemini ${model} returned no text`);
        console.log(`Model used: ${model}`);
        return text;
      } catch (error) {
        lastError = error;
        console.warn(`${model} attempt ${attempt} failed: ${error.message.slice(0, 200)}`);
        if (error.skipModel) break; // next model in the chain
        await new Promise((r) => setTimeout(r, attempt * 15000));
      }
    }
  }
  throw lastError;
}

const SAMPLE_BRIEF = `## Conversations to join today
- (dry-run sample) X thread complaining dating app bios all say "love to laugh". Draft reply: "Love to laugh, love to travel. A personality, or an airport? Asking for the app I built."

## Outreach target of the day
- (dry-run sample) Reply drafted to this week's post.

## Funding and opportunity watch
Nothing new today. Evergreen: UnLtd rolling awards; Access to Work; Stelios Awards next window around March.

## Moment watch
- July is Disability Pride Month: engage daily on #DisabilityPrideMonth.`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const target = ROTA[dayOfYear(now) % ROTA.length];
  console.log(`Outreach target today: ${target}`);

  let brief = dryRun ? SAMPLE_BRIEF : await callGeminiWithSearch(buildPrompt(niche, target, dateStr));

  // Guardrail sweep: flag (not silently drop) anything off-brand so the human sees it.
  const warnings = [];
  const violation = findViolation(brief, banned);
  if (violation) warnings.push(`Contains the banned phrase "${violation}". Edit before sending anything.`);
  for (const ch of BANNED_CHARACTERS) {
    if (brief.includes(ch)) { brief = brief.split(ch).join(', '); warnings.push('Em/en dashes found and auto-replaced with commas. Re-read the drafts.'); break; }
  }

  const lines = [];
  lines.push(`# Able2Love outreach brief: ${dateStr}`);
  lines.push('');
  lines.push('The robot hunted; a human sends. Review each draft, edit freely, bin what you dislike, then post replies from the Able2Love account (or hand the keepers to the Claude extension). Rules of the road: marketing/11-outreach-program.md');
  lines.push('');
  if (warnings.length) {
    lines.push('> **Guardrail warnings:**');
    for (const w of warnings) lines.push(`> - ${w}`);
    lines.push('');
  }
  lines.push(brief.trim());
  lines.push('');

  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `brief-${dateStr}.md`);
  await writeFile(file, lines.join('\n'));
  console.log(`Wrote outreach brief to ${path.relative(ROOT, file)}`);
}

main().catch((error) => {
  console.error('Outreach brief failed:', error);
  process.exit(1);
});
