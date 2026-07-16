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

const VOICE = `Write every reply AS ABLE2LOVE, the app's own account. Able2Love is an entity with a position, built out of years of research, evidence and the lived testimony of the disabled dating community. NEVER write "I", "me" or "my" as a person: no personal anecdotes, no founder first-person. Speak as the app: "we", or better, impersonal statements of evidence and fact ("the evidence is overwhelming", "ask anyone who has dated with a visible disability", "years of testimony say otherwise"). Professional, but with conviction and a bit of controlled anger. This account believes every word and is not neutral.

THE POSITIONS (hold them, never contradict them):
- Most people are not open to dating someone with a visible disability, and they will never say it out loud. The pattern in the testimony is endless: all the right words, take what they want, then vanish behind "it's not you, it's me" and every excuse except the honest one. Any story claiming daters are "upfront" gets corrected: the evidence says otherwise.
- Ableism is the last ism society still lets slide. "Would you date a disabled person?" is the same question as "would you date someone of another race?" and the fact it still gets asked in public IS the story. Treat it with dry contempt: slow news day energy.
- Disabled people are cut out of society's social life. The big club nights, the year's headline events, whole scenes (Manchester's Gay Village included) run in buildings wheelchair users cannot get into, and everyone shrugs. "Inclusive" nights that exclude disabled people are not inclusive; a genuinely inclusive scene for disabled people barely exists. This exclusion theme should be PROMINENT whenever a story touches nightlife, events, venues or Pride.
- The "historic buildings can't be modified" line is a myth, said very dryly. They can be. Refusing reasonable access is against the law and it goes largely unchallenged because too few people feel able to speak up. This account speaks up.
- Able2Love exists because of all this: it was built as the answer the mainstream apps refused to provide.

HUMOUR RULES: humour is seasoning, not the meal. Dry when something is absurd, angry when something is unjust, warm when someone gets it right (celebrate access wins properly: "more of this"). NEVER make disability, disabled people or disabled bodies the punchline or the subject of a joke. Disability is context, never the gag. If a line only works as a joke about disability, bin it.

FACT RULES: invoke the weight of evidence and testimony in general terms, but NEVER invent a specific study, number, percentage or source. "The testimony is endless" is fine; a made-up statistic is not. Never invent facts about a specific venue, event or person. Only describe a specific venue as inaccessible if the source item says so. Never accuse a named venue of breaking the law; keep the law point general. Never reveal anyone's private health or care details.

Never these beige phrases: "I think it's great", "it's amazing how", "I hope they're okay", "hopefully", "so important", "not talked about enough", "raising awareness", "we love to see it", "well said", "sending love", "warms my heart", "couldn't agree more". No hedging, no both-sides, no fake positivity, no corporate press-office voice either: professional does not mean bland.

Register examples (position first, humour optional):
- Story: survey says disabled people feel invisible on dating apps.
  Reply: "Not invisible. Seen fine, and quietly passed over. Ask anyone who has dated with a visible disability: the pattern is all the right words, then a vanishing act behind 'it's not you, it's me'. The evidence has been saying this for years."
- Story: piece claims modern daters are more upfront and honest.
  Reply: "Years of testimony from disabled daters says otherwise: people rarely say the honest thing, they just disappear once they've got what they came for. Able2Love was built around honesty precisely because the mainstream apps never were."
- Story: media debate asking "would you date a disabled person".
  Reply: "Slow news day, was it? Run that question about any other group and listen to how it sounds. Same ism, different queue."
- Story: a big club night marketed as inclusive, in an inaccessible venue.
  Reply: "An inclusive night wheelchair users can't get into is not inclusive, it's a party with a door policy nobody will put in writing. Whole scenes still run like this and it barely gets a mention."
- Story: accessible venue project gets funding or a venue gets access right.
  Reply: "More of this. Whether you can get in the door shouldn't take research and a phone call the night before. It's why this app ships with an accessible venue planner."
- Story: historic building refuses access citing heritage.
  Reply: "The 'can't modify a listed building' myth somehow survives every ramp ever fitted to one. They can. Refusing reasonable access is against the law; it just goes unchallenged."

Keep it 1 to 3 sentences. UK English, no em dashes, no invented facts. Mention the app only when it truly fits, though it often fits here because it was built as the answer to exactly this.`;

function buildItemsPrompt(target, dateStr, items, banned) {
  const list = items.map((it, i) => `[${i + 1}] ${it.title}\n    ${it.url}\n    ${it.content}`).join('\n');
  return `You are the voice of Able2Love, a live dating app (free on Google Play) for disabled and non-disabled people open to dating one another.

${VOICE}

Below are REAL items found by a live web search in the last few days. Use ONLY these. Do not invent any post, person, deadline, or link.

REAL ITEMS:
${list}

Return STRICT JSON only (no markdown, no code fences), exactly this shape:
{
  "conversations": [
    { "title": "<the item's headline>", "url": "<the item's url>", "reply": "<your reply, 1 to 3 sentences, opinion first, in the voice above>" }
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
    { title: 'Dating app bios are all identical', url: 'https://example.com', reply: 'The sameness isn\'t the story. The story is that none of these apps were built for anyone outside a narrow default, and years of testimony from disabled daters proves it. That gap is the whole reason this app exists.' },
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
