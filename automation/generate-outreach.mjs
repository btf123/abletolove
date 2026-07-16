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
import { generateText, hasLiveSearch } from './lib/llm.mjs';
import { hasTavily, gatherLiveItems } from './lib/search.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue/outreach');

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

function buildPrompt(niche, target, dateStr, mode, items = []) {
  const tone = niche.content_tone || 'direct, human and dryly funny';
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  const intro = `You are the outreach scout for Able2Love, a live dating app (free on Google Play) for disabled and non-disabled people open to dating one another. You write in the founder's voice: a Greater Manchester comedy writer, performer and full-time wheelchair user. Performer first. Dry humour, UK English, no em or en dashes ever, no pity framing, no invented facts. The only product claims allowed: the app exists, it is free on Google Play, and what it stands for (access needs up front, disclosure on your terms, accessible venue planning, See Me First profiles).

Today is ${dateStr}.`;

  const rules = `Rules for every drafted word: never use these phrases: ${banned}. Never praise non-disabled people merely for dating a disabled person. Never make disabled bodies, care needs or trauma the punchline. SKIP any item about death, grief, bereavement, serious illness, medical or sexual intimacy, or personal tragedy: a dating app replying to those reads as opportunistic, so do not draft a reply for them at all. Only draft replies where Able2Love can join naturally and appropriately (dating, accessibility, community, honesty, humour). Tone: ${tone}. Direct beats padded.`;

  if (mode === 'items') {
    const list = items.map((it, i) => `[${i + 1}] ${it.title}\n    ${it.url}\n    ${it.content}`).join('\n');
    return `${intro} Below are REAL items found by a live web search in the last few days. Use ONLY these; do not invent any other post, person, deadline or link. Some may be off topic; ignore those.

REAL ITEMS FOUND TODAY:
${list}

Produce a markdown brief with exactly these sections:

## Conversations to join today
Pick the 6 to 10 most relevant items above (disability and dating, dating app frustration, accessibility, chronic illness, interabled couples, disability pride, or anything the founder could genuinely comment on). For each, give: the headline and its link (copy the URL from the item), then a drafted reply IN THE FOUNDER'S VOICE. A genuine reaction first (agree, add an experience, make the dry joke, answer the point). Mention the app only if it truly belongs, never as "check out my app". Many should not mention it at all. 1 to 3 sentences.

## Outreach target of the day: ${target}
If any item above is about them, draft a reply to it (with the link). Otherwise draft a short warm DM referencing their known work (no invented specifics).

## Funding and opportunity watch
If any item above is a grant, award, press callout or podcast guest call, list it with its link. Otherwise say "Nothing new in today's results" and list the evergreen leads: UnLtd (£500 to £15,000, rolling, unltd.org.uk); Access to Work (gov.uk); Stelios Awards (annual, around March).

## Moment watch
Any awareness day or moment near ${dateStr} the brand can join honestly (for example July is Disability Pride Month). Only ones you are sure of.

${rules}`;
  }

  if (mode === 'grounding') {
    return `${intro} USE YOUR SEARCH TOOL for every section. Search the live web for CURRENT items from the last 1 to 3 days. UK first, but global always. Do not invent posts, people, deadlines or links; if search gives you nothing for a section, say so plainly.

Produce a markdown brief with exactly these sections:

## Conversations to join today
Find 8 to 12 FRESH items (last 72 hours): news stories, viral threads, X posts, Instagram posts or Reddit threads about any of: disability and dating, dating app frustrations, accessibility fails or wins, chronic illness dating, deaf dating, interabled couples, disability pride. For each item give what and where it is (platform, who posted, link if the search gives one), plus a drafted reply IN THE FOUNDER'S VOICE: a genuine reaction first (agree, add an experience, make the dry joke, answer the question). Mention the app only if it truly belongs, never as "check out my app" or a link drop. Many replies should not mention the app. 1 to 3 sentences each.

## Outreach target of the day: ${target}
Search what they posted or were in the news for THIS WEEK, then draft ONE engagement move: a reply to something specific and recent (preferred), or a short warm DM referencing their actual work.

## Funding and opportunity watch
Search for currently open grants for disabled entrepreneurs UK, social enterprise funding, accessible tech awards, press callouts (#JournoRequest), podcast guest calls. List anything OPEN now with its deadline, else "Nothing new today" plus the evergreen leads (UnLtd rolling; Access to Work; Stelios around March).

## Moment watch
Any awareness day or trending moment today or in the next 7 days the brand can join honestly.

${rules}`;
  }

  // No live search (free Groq): must NOT invent specific fresh posts. Draft
  // reusable, genuine material instead, and tell the human to find live posts.
  return `${intro} You do NOT have live web search today, so you must NOT invent or cite any specific recent post, person's tweet, news story, deadline or link. Only use the evergreen facts given below. Anything time-sensitive must be phrased as guidance for the human to act on, not as a real found item.

Produce a markdown brief with exactly these sections:

## Search these, then reply in my voice
List 6 hashtag or search terms to open today (rotate across: disabilitydating, spoonie, actuallyautistic, chronicillness, wheelchairlife, accessibility, deafcommunity, interabledcouple, datingwithadisability). For EACH, write one ready-to-use reply in the founder's voice that would fit a typical post under that tag: a genuine reaction, dry humour, app mentioned only if it belongs. The human will paste these under real recent posts they find.

## Outreach target of the day: ${target}
Draft one short, warm opener in the founder's voice for reaching out to them, referencing the kind of work they are known for (no invented specifics). The human checks their recent posts and adapts it.

## Funding and opportunity watch
List only these evergreen, real leads with a one-line next step each: UnLtd awards (£500 to £15,000, rolling, unltd.org.uk); Access to Work (gov.uk, funds a disabled founder's support costs); Stelios Awards for Disabled Entrepreneurs (annual, around March, grow-into-it). Remind the human to also skim #JournoRequest for press callouts.

## Moment watch
Name any awareness day you are certain of near this date (for example July is Disability Pride Month) and one honest way to join it. If unsure of a date, say so rather than guessing.

${rules}`;
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

  // Pick the best available search mode:
  //  - Tavily present: free live web search, draft with Groq (mode "items")
  //  - else Gemini present: paid grounding search (mode "grounding")
  //  - else: no search, reusable in-voice replies (mode "none")
  let mode = 'none';
  let items = [];
  if (!dryRun) {
    if (hasTavily()) {
      mode = 'items';
      items = await gatherLiveItems(target);
      console.log(`Mode: Tavily live search (free), ${items.length} items found`);
      if (!items.length) { mode = 'none'; console.log('No items returned; falling back to reusable replies'); }
    } else if (hasLiveSearch()) {
      mode = 'grounding';
      console.log('Mode: Gemini grounding search');
    } else {
      console.log('Mode: no live search; drafting reusable in-voice replies');
    }
  }

  let brief = dryRun
    ? SAMPLE_BRIEF
    : await generateText(buildPrompt(niche, target, dateStr, mode, items), { temperature: 0.7, search: mode === 'grounding' });

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
  lines.push('**No copying.** This brief lives on GitHub, so your Claude browser extension can read it straight from here. You never paste it. Your only job is to approve the ones you like.');
  lines.push('');
  lines.push('> **Standing instruction (say to the extension once, or each morning):** "Open my latest Able2Love outreach brief issue at github.com/btf123/abletolove/issues. For each item under \'Conversations to join today\', open its link and post the drafted reply as a comment from my @Able2LoveApp account, tweaking a word or two so it reads naturally. Show me each before posting and only post the ones I approve. Post AT MOST 5, space them a few minutes apart, skip anything I skip, and do not touch DMs."');
  lines.push('');
  lines.push('_The bot only drafts. Nothing posts until you approve it in your own browser. That approval is the safety. Rules: marketing/11-outreach-program.md_');
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
