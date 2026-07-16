#!/usr/bin/env node
/**
 * Able2Love daily outreach brief.
 *
 * Every morning this robot finds fresh, real conversations (Tavily search, free)
 * and drafts replies in Brogan's actual voice (Groq, free): edgy, dry, funny,
 * opinionated. NOT neutral AI mush. It writes both:
 *   content-queue/outreach/brief-<date>.json  (structured, for the dashboard buttons)
 *   content-queue/outreach/brief-<date>.md    (readable, for the review issue)
 *
 * IT NEVER POSTS. A human approves and sends. The hunt is automated, the hand
 * is human, and that approval is the safety.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText, hasLiveSearch } from './lib/llm.mjs';
import { hasTavily, gatherLiveItems } from './lib/search.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue/outreach');
const BANNED_CHARACTERS = ['—', '–'];

// Phrases that mean the reply has gone beige. Flagged so a human spots them.
const BANNED_MUSH = [
  "i think it's great", 'it is amazing how', "it's amazing how", 'i hope they', 'i hope he', 'i hope she',
  'hopefully', 'so important', 'not talked about enough', 'not discussed enough', 'being open and honest',
  'maybe we can all learn', 'sending love', 'we love to see it', 'couldn\'t agree more', 'well said',
  'raising awareness', 'warms my heart', 'this hits home', 'at the end of the day', 'kudos', 'props to',
];

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

const VOICE = `Write every reply AS Brogan Fox himself: a Manchester comedy writer, performer and full-time wheelchair user. Edgy, dry, blunt, a bit dark, quick with a joke, and OPINIONATED. You have real takes and you are not afraid of them. You are NOT a brand account, NOT customer service, NOT a neutral observer, and absolutely NOT a polite AI trying to please everyone.

THE ONE BIG FAILURE is sounding like a nice, neutral stranger. Every reply must land a joke, a sharp opinion, or a specific lived observation. If any polite person could have typed it, it is WRONG. Bin it and write something with teeth.

Never write anything like these beige phrases: "I think it's great", "it's amazing how", "I hope they're okay", "hopefully", "so important", "not talked about enough", "being open and honest is key", "maybe we can all learn", "sending love", "we love to see it", "couldn't agree more", "well said", "raising awareness", "warms my heart". No hedging, no both-sides, no polite sign-offs, no emoji-brain positivity.

Register examples (match this energy):
- WRONG: "Accessibility should be a no-brainer, but it's amazing how often it gets forgotten."
  RIGHT: "Genuinely wild that in 2026 'can disabled people get through the front door' is still filed under nice-to-have. Design it in or just admit you didn't think we'd turn up."
- WRONG: "It's great people are talking about how chronic illness affects relationships."
  RIGHT: "Refreshing to see this talked about like adults instead of whispered about at the GP. Disabled people have love lives, staggering scenes, more at eleven."
- WRONG: "Love to laugh, love to travel."
  RIGHT: "'Loves to travel, no drama.' A personality, or a departures board?"

Keep it 1 to 2 sentences. Type like a real, funny person firing off a quick reply, not a press office. UK English, no em dashes, no invented facts. Mention the app only if it genuinely belongs, never as "check out my app".`;

function buildItemsPrompt(target, dateStr, items, banned) {
  const list = items.map((it, i) => `[${i + 1}] ${it.title}\n    ${it.url}\n    ${it.content}`).join('\n');
  return `You are Brogan Fox, founder of Able2Love, a live dating app (free on Google Play) for disabled and non-disabled people open to dating one another.

${VOICE}

Below are REAL items found by a live web search in the last few days. Use ONLY these. Do not invent any post, person, deadline, or link.

REAL ITEMS:
${list}

Return STRICT JSON only (no markdown, no code fences), exactly this shape:
{
  "conversations": [
    { "title": "<the item's headline>", "url": "<the item's url>", "reply": "<your reply, 1 to 2 sentences, in the voice above>" }
  ],
  "target_reply": "<a reply or short DM to today's outreach target: ${target}, in your voice>",
  "funding": "<one line: any grant/award/press callout among the items with its link, else 'Nothing new today' plus UnLtd (unltd.org.uk), Access to Work (gov.uk), Stelios Awards (around March)>",
  "moment": "<any awareness day near ${dateStr}, e.g. July is Disability Pride Month, and one honest, funny way to join it>"
}

For "conversations": include the 5 to 8 BEST items where you can genuinely and sharply weigh in (disability, dating, accessibility, relationships, community, disability pride, dating-app nonsense). SKIP entirely, do not include, any item about death, grief, bereavement, self-harm, or raw personal tragedy: replying to those reads as opportunistic. Relationships, sex and disability are fair game and your home turf, handle with wit, not crassness.

Never use these banned words or phrases anywhere: ${banned}. Never make disabled bodies or care needs the punchline. Never praise non-disabled people just for dating a disabled person.`;
}

function renderMarkdown(dateStr, data, warnings) {
  const lines = [];
  lines.push(`# Able2Love outreach brief: ${dateStr}`);
  lines.push('');
  lines.push('**Approve with buttons, not copy-paste.** Open this on your dashboard (btf123.github.io/abletolove/dashboard/) to tick Yes/No on each reply, then hand the approved set to your extension. Nothing posts until you approve it. That approval is the safety.');
  lines.push('');
  if (warnings.length) {
    lines.push('> **Heads up:**');
    for (const w of warnings) lines.push(`> - ${w}`);
    lines.push('');
  }
  lines.push('## Conversations to join today');
  lines.push('');
  (data.conversations || []).forEach((c, i) => {
    lines.push(`**${i + 1}. ${c.title}**`);
    if (c.url) lines.push(c.url);
    lines.push('');
    lines.push(`> ${c.reply}`);
    if (c.mush) lines.push('> _(sounds a bit flat, sharpen before sending)_');
    lines.push('');
  });
  lines.push(`## Outreach target of the day: ${data.target}`);
  lines.push('');
  lines.push(`> ${data.target_reply || ''}`);
  lines.push('');
  lines.push('## Funding and opportunity watch');
  lines.push('');
  lines.push(data.funding || 'Nothing new today.');
  lines.push('');
  lines.push('## Moment watch');
  lines.push('');
  lines.push(data.moment || '');
  lines.push('');
  return lines.join('\n');
}

function parseJson(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON object in model output');
  return JSON.parse(cleaned.slice(s, e + 1));
}

function scrub(text) {
  let t = String(text || '');
  for (const ch of BANNED_CHARACTERS) t = t.split(ch).join(', ');
  return t.trim();
}
function isMush(text) {
  const hay = String(text || '').toLowerCase();
  return BANNED_MUSH.some((p) => hay.includes(p));
}

const SAMPLE = {
  conversations: [
    { title: 'Dating app bios are all identical', url: 'https://example.com', reply: '"Loves to travel, no drama." A personality, or a departures board? The bar is on the floor and people keep bringing shovels.' },
  ],
  target: '(dry-run) Molly Burke',
  target_reply: 'Your no-nonsense stuff is the good kind of viral. Built an app in a similar spirit, might be up your street.',
  funding: 'Nothing new today. Evergreen: UnLtd, Access to Work, Stelios (around March).',
  moment: 'July is Disability Pride Month. Post like you mean it, not like an HR department.',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = (niche.campaign_guardrails?.banned_language || []).join('; ');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const target = ROTA[dayOfYear(now) % ROTA.length];
  console.log(`Outreach target today: ${target}`);

  let data;
  if (dryRun) {
    data = { ...SAMPLE, target };
  } else if (hasTavily()) {
    const items = await gatherLiveItems(target);
    console.log(`Tavily live search: ${items.length} items`);
    if (!items.length) { console.log('No items found; skipping brief today.'); return; }
    const raw = await generateText(buildItemsPrompt(target, dateStr, items, banned), { temperature: 0.85 });
    data = parseJson(raw);
    data.target = target;
  } else {
    console.log('No TAVILY_API_KEY set; outreach needs it for live search. Skipping.');
    return;
  }

  // Clean + flag. Keep everything (human decides), but mark flat or off-brand replies.
  const warnings = [];
  data.conversations = (data.conversations || []).map((c) => {
    const reply = scrub(c.reply);
    const mush = isMush(reply);
    if (mush) warnings.push(`"${(c.title || '').slice(0, 40)}" reply sounds flat; sharpen it.`);
    return { title: scrub(c.title), url: c.url || '', reply, mush };
  });
  data.target_reply = scrub(data.target_reply);
  data.funding = scrub(data.funding);
  data.moment = scrub(data.moment);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, `brief-${dateStr}.json`), JSON.stringify({ date: dateStr, ...data }, null, 2));
  await writeFile(path.join(OUT_DIR, `brief-${dateStr}.md`), renderMarkdown(dateStr, data, warnings));
  console.log(`Wrote outreach brief (${data.conversations.length} conversations) for ${dateStr}`);
}

main().catch((error) => {
  console.error('Outreach brief failed:', error);
  process.exit(1);
});
