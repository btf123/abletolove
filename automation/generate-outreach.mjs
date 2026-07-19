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
import { hasTavily, gatherLiveItems, findTweets } from './lib/search.mjs';
import { lessonsPromptBlock } from './lib/lessons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue/outreach');
const BANNED_CHARACTERS = ['—', '–'];

// Phrases that mean the reply has gone beige. A reply that trips this gets sent
// back through a harsher rewrite; if it still trips after that, it's flagged.
const BANNED_MUSH = [
  "i think it's great", 'it is amazing how', "it's amazing how", 'i hope they', 'i hope he', 'i hope she',
  'hopefully', 'so important', 'not talked about enough', 'not discussed enough', 'being open and honest',
  'maybe we can all learn', 'sending love', 'we love to see it', 'couldn\'t agree more', 'well said',
  'raising awareness', 'warms my heart', 'this hits home', 'at the end of the day', 'kudos', 'props to',
  // The exact tells from the beige drafts the founder rejected:
  'here to change', 'here to provide', 'safe space', 'connect and thrive', 'deserve better',
  'deserve to be', 'proud to', 'amplify the voices', 'not a niche', 'not just a nicety', 'an afterthought',
  'tokenistic', 'inspiration to', 'love your work', 'powerful example', 'drive change', 'matter of life and death',
  'is here to', 'thrive', 'a reminder that', 'basic requirement', 'a necessity', 'shine a light',
  // The NGO/essay register tells from the second beige run (the real problem is
  // this voice, not single words). Tripping any of these forces a blunt rewrite.
  'stark reminder', 'a reminder', 'it is time to', "it's time to", 'time to confront', 'time to challenge',
  'seen and respected', 'unique experiences', 'unique perspectives', 'more inclusive world', 'more inclusive society',
  'more inclusive and accepting', 'marginalize', 'marginalise', 'lip service', 'so much to offer', 'testament to',
  'powerful reminder', 'tireless advocacy', 'challenge the stigma', 'acceptance and understanding', 'work that still needs',
  'reflection of our own', 'confront this bias', 'individuals with', 'not defined by their', 'the importance of creating',
  'work towards', 'strive to', 'let us', "let's use", "let's work", 'we must', 'we need to challenge',
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

const VOICE = `You reply from the Able2Love account, but you write like a real person who built it and genuinely cares, not a brand and not an AI. Able2Love is a dating app for disabled and non-disabled people, made by someone who was sick of the way mainstream apps treat disabled daters. You are on the same side as the person you are replying to. You get it, and most of the time you agree with them.

THE ONE BELIEF EVERYTHING TRACES BACK TO: the way disabled people get treated on the big dating apps, and shut out of so much of normal social life, is wrong, and Able2Love exists to change it. That is the whole heart of it. Every reply is a different, fresh expression of that same conviction. Same belief underneath, never the same words on top.

THE MAIN RULE: react to what the post actually IS, the way a person would, not with one stock shape every time.
- Someone sharing a rough experience (ghosted, passed over, made to feel like a burden): agree and back them up. Tell them they are right and it was never them. Warm and on their side, never a lecture.
- Someone asking a genuine question (how do I bring up my disability, where is actually accessible): help them. Answer it warmly and honestly.
- Someone celebrating (a good date, a place that got access right, a small win): be happy for them and say so. Mean it.
- Someone calling out underrepresentation or lazy design: agree hard. Yes, this is exactly it, you have seen it too.
- Something genuinely absurd or unfair: you can be a bit dry about the situation, but stay warm to the person.

YOUR TONE: warm, human, on their side, sometimes funny, always kind to the person you are talking to. Like a mate who happens to have built the app and knows exactly what they mean. You HAVE an opinion and you are not shy, but the opinion comes out as warm agreement, not cold analysis. You are NOT negative and you are not down on people. The anger, when there is any, is aimed at the apps and the barriers, never at the person in front of you.

NEVER DO THESE:
- Never sound like an essay, a charity press office, a policy report, or a clever AI. If a line reads like something a brand would tweet, bin it and say it like a person.
- Never be preachy or lecture. No "access should be the baseline", no "it is a legal requirement", no "not a favour", no "reasonable adjustment", no telling people what they "deserve" as if reading a mission statement. Just be a person who agrees.
- Never make disability, disabled people or disabled bodies the punchline. Disability is context, never the joke.
- Never invent facts, studies, numbers, or claims about a specific venue, person, company, or about the app's features. Speak from real shared feeling, not made-up data.
- Never open two replies the same way, reuse an image, or run the same argument twice. Real people do not have catchphrases.

Mention the app only when it genuinely fits and only naturally, at most once, never as a plug bolted on the end.

Keep it short and human: usually 1 to 2 sentences, the length a real person actually types. UK English. No em dashes or en dashes.

Examples of the RIGHT feel (copy the warmth and how each one is DIFFERENT, never the words):
- Post: "matched with a guy, told him I use a wheelchair, instant unmatch."
  Reply: "That tells you everything about him and nothing about you. Genuinely his loss. You want someone who is just glad it's you, and he was never it."
- Post: "why is it so hard to find a dating app that actually thinks about disabled people?"
  Reply: "Because barely any of them were built with us in the room, and you feel it in every corner of the design. Honestly that frustration is the whole reason Able2Love got made."
- Post: "finally had a first date somewhere I could actually get into and it was lovely, no stress."
  Reply: "Oh this is lovely to read. It should be normal and not a win, but when it goes right like that it really is the best feeling. So happy for you."
- Post: "disabled people want the same things as anyone, we're not here to be anyone's lesson, we just want a text back."
  Reply: "Yes. Same wants as everyone, someone funny who actually replies. The 'brave and amazing' framing helps no one and most of us are quietly begging for a normal Tuesday date."
- Post: "another 'inclusive' night in a venue you can't get a wheelchair into."
  Reply: "Every time. Calling it inclusive while half your crowd can't get through the door is a bit of a stretch, isn't it. People notice, even when nobody says it out loud."`;

function buildItemsPrompt(target, dateStr, items, banned, lessonsBlock = '') {
  const list = items.map((it, i) => `[${i + 1}] ${it.title}\n    ${it.url}\n    ${it.content}`).join('\n');
  return `You are the voice of Able2Love, a live dating app (free on Google Play) for disabled and non-disabled people open to dating one another.

${VOICE}${lessonsBlock}

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

// Second pass. The first draft tends to drift beige (booster phrases, "here to
// provide a safe space", first-person warmth to the target). This editor rewrites
// every reply harder into the entity voice. It only rewrites, never invents: same
// items, same links, same target, just sharper words.
function buildSharpenPrompt(target, drafts, banned, lessonsBlock = '') {
  return `You are the editor for Able2Love's account. The junior drafter keeps slipping into a cold, preachy register that reads like a charity or an AI: "access should be the baseline, not a specialist request", "the impact of X is a stark reminder that...", "people deserve to be seen as individuals". It sounds negative, vague and nothing like a real person. Your ONE job: rewrite every reply so it is WARM, human, and on the poster's side, while making the same point.

${VOICE}${lessonsBlock}

HARD RULES for the rewrite:
1. WARM AND ON THEIR SIDE. Talk to the person, not about the issue. If they had a rough time, agree and back them up. If they asked something, help. If they are celebrating, be glad for them. Never a lecture.
2. SAY IT LIKE A PERSON TEXTING. Usually 1 to 2 short sentences. Natural, not an essay and not a slogan. It is fine to be brief if brief is warm and lands.
3. KILL THE PREACHY REGISTER. No "access should be the baseline", "a specialist request", "it is a legal requirement", "not a favour", "reasonable adjustment", "stark reminder", "deserve to be seen", "raising awareness", "it's time to", "we must", "lip service". If one appears, you have failed.
4. Warm but TRUE. Speak from real shared feeling. Do NOT invent a fact about the named company, app, person, study or venue in the story, and do NOT invent specific Able2Love features. If the item does not state it, you may not assert it.
5. Describe the app, if at all, only in warm human terms (built by someone sick of how the big apps treat disabled daters; made so disabled and non-disabled people can actually meet). At most once, worded fresh, never a plug bolted on the end.
6. Never negative AT the person. Any edge is aimed at the apps or the barriers, never the human you are replying to. No comma-spliced grievance lists.
7. The target reply is a warm, genuine note to a peer you admire, in your own words, never "Hi [name], your work is a powerful reminder".
8. Keep each item's title and url EXACTLY as given. UK English, no em dashes, no invented facts, studies, numbers or venue claims.

TRANSFORM EXAMPLES (warmth and difference, never the words):
- Post: someone asks if a venue can sort step-free access for a date.
  TOO COLD: "Access should be the baseline, not a specialist request. This is a legal requirement, not a favour."
  RIGHT: "Fingers crossed they sort it. It's mad that this is still the bit you have to chase, but I hope the date's brilliant either way."
- Post: study says disabled people feel invisible on the apps.
  TOO COLD: "The data is a stark reminder that disabled daters are systematically overlooked."
  RIGHT: "Not surprised, and I'm sorry it's like that. So many of us have felt exactly this. It's the whole reason Able2Love got built."
- Post: someone celebrates an accessible first date.
  TOO COLD: "Accessible venues should be the norm, not a cause for celebration."
  RIGHT: "Ah this made me smile. It should be normal, but a date where you're not stressing about the door is the best. So happy for you."

DRAFTS TO REWRITE (JSON):
${JSON.stringify({ conversations: drafts.conversations, target, target_reply: drafts.target_reply }, null, 2)}

Return STRICT JSON only (no markdown, no code fences), exactly this shape:
{
  "conversations": [ { "title": "<unchanged>", "url": "<unchanged>", "reply": "<rewritten, warm, human, on their side, no invented specifics>" } ],
  "target_reply": "<rewritten, warm and genuine to a peer, in your own words, no invented specifics>"
}

Never use these banned words or phrases anywhere: ${banned}.`;
}

// Last-resort salvage. Any single reply that still reads essay-soft after the
// editor pass gets one more blunt, length-capped rewrite of just that line.
function buildSalvagePrompt(title, reply, banned) {
  return `This reply for Able2Love's account missed: it is either cold and preachy (reads like a charity or an AI), or an empty stub with nothing human in it. Rewrite it warm and on the poster's side, the way a real person would text: usually 1 to 2 short sentences. Agree with them, back them up, help, or be glad for them, whatever the post calls for. No "access should be the baseline", "a legal requirement", "not a favour", "stark reminder", "deserve to be seen", "it's time to", "raising awareness", "we must", no preachy or advocacy phrasing at all. Speak from real shared feeling. Do NOT invent a fact about the named company, app, person or venue, and do NOT invent specific Able2Love features: if the story does not state it, do not assert it. Any edge is aimed at the apps or the barriers, never at the person. UK English, no em dashes.

STORY: ${title}
REPLY THAT MISSED: ${reply}

Return ONLY the rewritten reply text, nothing else. Never use: ${banned}.`;
}

// The assisted Instagram hit-list: WHO to engage and a drafted comment, so the
// founder (who does not know Instagram well) never has to figure out where to
// look. Manual and human-paced by design; the bot researches and drafts, the
// hand stays human. It suggests known creators and hashtags to browse, and does
// NOT invent handles or claim what a specific post says.
const IG_HASHTAGS = ['#disabilitydating', '#spoonie', '#actuallyautistic', '#accessibility', '#wheelchairlife', '#disabilitycommunity', '#chronicillness', '#invisibledisability'];

function buildHitlistPrompt(lessonsBlock = '') {
  return `You plan a daily Instagram engagement list for Able2Love, a dating app for disabled and non-disabled people, built by Brogan (a Manchester wheelchair user). He does not know Instagram well and needs telling exactly WHO to engage with and roughly what to say.

${VOICE}${lessonsBlock}

Produce 6 suggestions. Mix these two kinds:
- Creators/communities to check: pick from disability, dating, accessibility and Manchester-scene creators and community accounts (for example the kinds of people who post about interabled relationships, disabled dating, access wins and fails). Describe WHO to look for by kind, do not invent a specific @handle or claim what their latest post says.
- Hashtags to browse: from ${IG_HASHTAGS.join(', ')}. Say what kind of recent post to look for under it (someone venting about mainstream apps, an access-fail story, an access win to celebrate).

For each, write a short genuine COMMENT in the voice above that Brogan can adapt to the actual post: warm when someone gets access right, dry when something is absurd, backing them up with the shared position. Never make disability the punchline. Never invent facts.

Return STRICT JSON only: {"instagram_hitlist":[{"who":"<who to check / which hashtag and what to look for>","why":"<one short line on why it fits>","comment":"<a drafted comment, 1 to 2 sentences, in voice>"}]}.`;
}

// The daily engagement mission: ONE block the founder pastes into his Claude
// browser extension. The extension is logged into X and Instagram, so it can do
// what this server-side scout cannot: find REAL posts on the platforms, draft a
// reply per post in the voice, get a per-item yes from the founder in chat, and
// post the approved ones. Skips get replaced so the day's target is still hit.
// The scout's news finds become adaptable ammo lines, not reply targets.
function buildMission(data, target, dateStr) {
  const ammo = (data.conversations || []).map((c) => `- ${c.reply}`).join('\n');
  const hitlist = (data.instagram_hitlist || []).map((h) => `- ${h.who}\n  Seed comment: ${h.comment}`).join('\n');
  return `Task: today's Able2Love engagement round (${dateStr}). You are working in my logged-in browser as the app's accounts: @Able2LoveApp on X, @able2loveapp on Instagram.

APPROVAL RULE, NEVER BREAK IT: before posting anything, show me the post you found and your drafted reply, and wait for my yes. Never post without a yes for that specific item. If I say no or skip, find a replacement candidate so we still hit today's targets.

TARGETS: 10 replies on X and 5 comments on Instagram, found and posted a few at a time (pause whenever I say pause). Skip and tell me if we run out of genuinely good candidates; never pad with weak ones.

FINDING CANDIDATES:
- X: use x.com search (Latest tab) for: disability dating, dating with a disability, accessible venue, wheelchair nightlife, #DisabilityDating, #DisabledAndDating, chronic illness dating, plus anything matching today's ammo below. Real people only: skip news outlets, brands, giveaways, and anything about death, grief, tragedy or self-harm.
- Instagram: work through the hit-list below (hashtag pages and creator types), picking recent posts where a comment genuinely fits.

VOICE, NON-NEGOTIABLE: write from the Able2Love account like a real person who built it and cares, warm and on the poster's side. React to what each post actually is: agree and back people up when they've had a rough time, help when they ask, be glad for them when they celebrate. You HAVE an opinion, warm agreement not cold analysis, all tracing back to one belief: the way disabled daters get treated on the big apps is wrong and this app is changing it. Usually 1 to 2 short sentences on X, shorter is fine for IG. UK English. NEVER use an em dash or en dash. Disability is never the punchline. Never invent facts, studies, numbers, or claims about any venue, person, company, or the app's features. Never argue; skip hostile threads. Never preachy or lecturing: no "access should be the baseline", "legal requirement", "not a favour", "stark reminder", "raising awareness", "it's time to". Never negative at the person. Every reply a different shape: never reuse a phrase across replies, never post the ammo lines verbatim.

TODAY'S AMMO (adapt these angles to the actual post in front of you, reworded fresh every time):
${ammo || '- (no ammo today; work from the voice rules alone)'}

INSTAGRAM HIT-LIST:
${hitlist || '- (no hit-list today; use the hashtags above)'}

OUTREACH TARGET OF THE DAY: ${target}. If you find their account, show me their recent post and a drafted comment; same approval rule.

At the end, give me a short tally: how many posted on each platform, and anything you skipped as sensitive.`;
}

function renderMarkdown(dateStr, data, warnings) {
  const lines = [];
  lines.push(`# Able2Love outreach brief: ${dateStr}`);
  lines.push('');
  lines.push('**One paste, done.** Copy the mission below into your Claude extension (in the browser where you are logged into X and Instagram). It finds real posts, drafts each reply in your voice, waits for your yes per item, posts the approved ones, and replaces anything you skip. Nothing posts without your yes. That approval is the safety.');
  lines.push('');
  if (data.mission) {
    lines.push('## Today\'s engagement mission (paste this into the extension)');
    lines.push('');
    lines.push('```');
    lines.push(data.mission);
    lines.push('```');
    lines.push('');
    lines.push('Everything below is the raw material the mission is built from, for reference.');
    lines.push('');
  }
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
  if ((data.instagram_hitlist || []).length) {
    lines.push('## Instagram hit-list (open these, leave a genuine comment)');
    lines.push('');
    lines.push('Spaced out through the day, a few at a time, not all at once. The comment is a starting point, tweak it to fit the actual post.');
    lines.push('');
    data.instagram_hitlist.forEach((h, i) => {
      lines.push(`**${i + 1}. ${h.who}**`);
      if (h.why) lines.push(`_${h.why}_`);
      lines.push(`> ${h.comment}`);
      lines.push('');
    });
  }
  return lines.join('\n');
}

function parseJson(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON object in model output');
  const body = cleaned.slice(s, e + 1);
  try {
    return JSON.parse(body);
  } catch (err) {
    // Cheap first aid for the usual model slip: trailing commas before } or ].
    return JSON.parse(body.replace(/,(\s*[}\]])/g, '$1'));
  }
}

// Generate text and parse it as JSON, self-healing one malformed response.
// A model occasionally drops a comma or leaves a stray quote; rather than lose
// the whole brief, hand the broken text back and ask it to return valid JSON.
async function generateJson(prompt, opts = {}) {
  const raw = await generateText(prompt, opts);
  try {
    return parseJson(raw);
  } catch (err) {
    console.warn(`JSON parse failed (${err.message.slice(0, 80)}); asking the model to repair it.`);
    const repairPrompt = `The text below was meant to be one strict JSON object but does not parse (${err.message}). Return ONLY the corrected JSON object: no code fences, no commentary, and escape any double quotes that appear inside string values.\n\n${raw}`;
    return parseJson(await generateText(repairPrompt, opts));
  }
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
function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}
// A dead, telegraphic stub ("Dating apps fail accessibility.") has no argument
// and no voice. Too short is as wrong as too beige.
function isStub(text) {
  return wordCount(text) < 5;
}
// A reply needs rework if it is beige OR a lifeless stub.
function needsWork(text) {
  return isMush(text) || isStub(text);
}

// Catchphrases the account has already leaned on so often they read as a bot
// watermark ("testimony from disabled daters..." on half the replies). Retired
// outright: any occurrence forces a rewrite.
const BURNED = [
  'testimony', 'the evidence', 'evidence is', 'ask anyone who', 'all the right words',
  'vanishing act', 'quietly passed over', "it's not you, it's me", 'built as the answer',
  'that gap is why', 'the gap this app', 'door policy', 'slow news day', 'same ism',
  'says otherwise', 'the pattern is',
  // The preachy/legalistic/business tells from the run the founder rejected:
  'the baseline', 'a specialist request', 'legal requirement', 'reasonable access',
  'reasonable adjustment', 'not a favour', 'not a favor', 'deserves airtime',
  'tells its own story', 'someone signed off', 'the fit-out', 'the competition',
  'stark reminder', 'it is time to', "it's time to",
];
function burnedIn(text) {
  const hay = String(text || '').toLowerCase();
  return BURNED.filter((p) => hay.includes(p));
}
// Any 5-word run shared between two replies means the bot is coining a NEW
// catchphrase; the later reply gets rewritten.
function sharedRun(a, b, n = 5) {
  const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  const wa = words(a); const grams = new Set();
  for (let i = 0; i + n <= wa.length; i++) grams.add(wa.slice(i, i + n).join(' '));
  const wb = words(b);
  for (let i = 0; i + n <= wb.length; i++) {
    const g = wb.slice(i, i + n).join(' ');
    if (grams.has(g)) return g;
  }
  return null;
}

function buildFreshPrompt(title, reply, avoid, banned) {
  return `This reply for Able2Love's account repeats wording the account has already used elsewhere, which makes it read like a bot with catchphrases. Rewrite it so it makes the same point in genuinely fresh words, warm and human, as a real person on the poster's side would. It must NOT contain any of these phrases or anything close to them: ${avoid.map((a) => `"${a}"`).join(', ')}. Keep it warm and natural, usually 1 to 2 short sentences, UK English, no em dashes, no invented facts. Any edge is aimed at the apps or barriers, never at the person. No preachy or advocacy phrasing ("access should be the baseline", "stark reminder", "raising awareness", "it's time to").

STORY: ${title}
REPLY TO REWRITE: ${reply}

Return ONLY the rewritten reply text. Never use: ${banned}.`;
}

const SAMPLE = {
  conversations: [
    { title: 'Dating app bios are all identical', url: 'https://example.com', reply: "Honestly, barely any of these apps were built with disabled daters in the room, and you feel it everywhere. That's the whole reason Able2Love got made." },
  ],
  target: '(dry-run) Molly Burke',
  target_reply: "Love how straight-talking your stuff is. Built something in a similar spirit and reckon you'd get exactly why.",
  funding: 'Nothing new today. Evergreen: UnLtd, Access to Work, Stelios (around March).',
  moment: 'July is Disability Pride Month. Post like you actually mean it, warm and real.',
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
    const lessonsBlock = await lessonsPromptBlock();
    data = await generateJson(buildItemsPrompt(target, dateStr, items, banned, lessonsBlock), { temperature: 0.85 });
    data.target = target;

    // Editor pass: rewrite the drafts harder into the entity voice. Best-effort;
    // if it fails or returns junk, keep the first draft rather than lose the brief.
    try {
      const sharp = await generateJson(
        buildSharpenPrompt(target, data, banned, lessonsBlock), { temperature: 0.7 },
      );
      const byUrl = new Map((sharp.conversations || []).map((c) => [c.url, c.reply]));
      let rewritten = 0;
      data.conversations = (data.conversations || []).map((c) => {
        const better = byUrl.get(c.url);
        if (better && String(better).trim()) { rewritten += 1; return { ...c, reply: better }; }
        return c;
      });
      if (sharp.target_reply && String(sharp.target_reply).trim()) data.target_reply = sharp.target_reply;
      console.log(`Editor pass sharpened ${rewritten}/${data.conversations.length} replies.`);
    } catch (e) {
      console.warn(`Editor pass skipped (${e.message.slice(0, 120)}); using first drafts.`);
    }

    // Salvage loop: any reply that still missed (essay-soft OR a dead stub)
    // gets one more rewrite aimed at the middle band. Keep it only if the
    // rewrite is actually better (clears the filter and has some substance).
    let salvaged = 0;
    const rescue = async (title, text) => {
      const fixed = scrub(await generateText(buildSalvagePrompt(title, text, banned), { temperature: 0.6 }));
      return fixed && !needsWork(fixed) ? fixed : null;
    };
    for (const c of data.conversations || []) {
      if (!needsWork(c.reply)) continue;
      try {
        const fixed = await rescue(c.title, c.reply);
        if (fixed) { c.reply = fixed; salvaged += 1; }
      } catch (e) {
        console.warn(`Salvage skipped for "${(c.title || '').slice(0, 30)}": ${e.message.slice(0, 80)}`);
      }
    }
    if (needsWork(data.target_reply)) {
      try { const f = await rescue(`outreach to ${target}`, data.target_reply); if (f) { data.target_reply = f; salvaged += 1; } } catch { /* keep prior */ }
    }
    // The moment line skips the editor pass, so it drifts beige. Discipline it too.
    if (isMush(data.moment)) {
      try { const f = await rescue(`Disability Pride Month angle`, data.moment); if (f) { data.moment = f; salvaged += 1; } } catch { /* keep prior */ }
    }
    if (salvaged) console.log(`Salvage loop rescued ${salvaged} repl${salvaged === 1 ? 'y' : 'ies'}.`);

    // Assisted Instagram hit-list. Best-effort; a failure never sinks the brief.
    try {
      const hl = await generateJson(buildHitlistPrompt(lessonsBlock), { temperature: 0.8 });
      data.instagram_hitlist = (hl.instagram_hitlist || []).slice(0, 8).map((h) => ({
        who: scrub(h.who), why: scrub(h.why), comment: scrub(h.comment),
      })).filter((h) => h.who && h.comment);
      console.log(`Instagram hit-list: ${data.instagram_hitlist.length} suggestions.`);
    } catch (e) {
      console.warn(`Hit-list skipped (${e.message.slice(0, 100)}).`);
    }

    // Variety pass: no burned catchphrases anywhere, and no 5-word run repeated
    // across replies. Anything that trips gets one fresh rewrite; if the rewrite
    // still trips it is kept but flagged for the human.
    const pieces = [];
    for (const c of data.conversations || []) pieces.push({ get: () => c.reply, set: (v) => { c.reply = v; }, title: c.title });
    pieces.push({ get: () => data.target_reply, set: (v) => { data.target_reply = v; }, title: `outreach to ${target}` });
    pieces.push({ get: () => data.moment, set: (v) => { data.moment = v; }, title: 'the moment-watch line' });
    for (const h of data.instagram_hitlist || []) pieces.push({ get: () => h.comment, set: (v) => { h.comment = v; }, title: h.who });

    let freshened = 0;
    const earlier = [];
    for (const p of pieces) {
      const text = p.get();
      const avoid = new Set(burnedIn(text));
      for (const prev of earlier) { const run = sharedRun(prev, text); if (run) avoid.add(run); }
      if (avoid.size) {
        try {
          const fixed = scrub(await generateText(buildFreshPrompt(p.title, text, [...avoid], banned), { temperature: 0.9 }));
          const stillBad = burnedIn(fixed).length || earlier.some((prev) => sharedRun(prev, fixed));
          if (fixed && !stillBad && !isStub(fixed)) { p.set(fixed); freshened += 1; }
        } catch (e) { console.warn(`Variety rewrite skipped for "${String(p.title).slice(0, 30)}": ${e.message.slice(0, 80)}`); }
      }
      earlier.push(p.get());
    }
    if (freshened) console.log(`Variety pass rewrote ${freshened} repetitive repl${freshened === 1 ? 'y' : 'ies'}.`);

    // Compose the one-paste engagement mission from the freshened material.
    data.mission = buildMission(data, target, dateStr);

    // REAL X posts to reply to, with drafted replies and spares. These power
    // the dashboard's yes/no queue: yes posts by API, no swaps in a spare.
    try {
      const tweets = (await findTweets()).slice(0, 18);
      console.log(`Found ${tweets.length} real X post(s) to draft replies for.`);
      if (tweets.length) {
        const list = tweets.map((t, i) => `[${i}] @${t.author}: ${t.text}`).join('\n');
        const raw = await generateJson(`You are the voice of Able2Love, a live dating app for disabled and non-disabled people.

${VOICE}

Below are REAL posts from X found by search. For each, reply the way a warm, real person on their side would, reacting to what that post actually IS: if they had a rough time, agree and back them up; if they asked something, help; if they are celebrating, be glad for them; if it is absurd or unfair, be a bit dry about the situation but warm to them. Every reply a different shape, all tracing back to the one belief that the way disabled daters get treated is wrong and Able2Love is changing it. Usually 1 to 2 short sentences, under 260 characters, never preachy, never a lecture, never negative at the person. If a post is hostile, sexual, about grief or tragedy, from a brand or news outlet rather than a person, or nothing warm and genuine fits, mark it skip.

POSTS:
${list}

Return STRICT JSON only: {"replies":[{"i":<index>,"skip":true|false,"reply":"<text if not skip>"}]}. One entry per index. Never use these banned words or phrases anywhere: ${banned}.`, { temperature: 0.85 });
        const byIdx = new Map((raw.replies || []).map((r) => [r.i, r]));
        data.x_candidates = [];
        const priorTexts = [];
        for (let i = 0; i < tweets.length; i++) {
          const r = byIdx.get(i);
          if (!r || r.skip || !scrub(r.reply)) continue;
          let reply = scrub(r.reply);
          const avoid = new Set(burnedIn(reply));
          for (const prev of priorTexts) { const run = sharedRun(prev, reply); if (run) avoid.add(run); }
          if (avoid.size) {
            try {
              const fixed = scrub(await generateText(buildFreshPrompt(`reply to @${tweets[i].author}`, reply, [...avoid], banned), { temperature: 0.9 }));
              if (fixed && !burnedIn(fixed).length) reply = fixed;
            } catch { /* keep original */ }
          }
          if (reply.length > 270) reply = reply.slice(0, 267) + '...';
          priorTexts.push(reply);
          data.x_candidates.push({ id: tweets[i].id, author: tweets[i].author, url: tweets[i].url, post: tweets[i].text.slice(0, 240), reply });
        }
        console.log(`X reply queue: ${data.x_candidates.length} candidate(s) incl. spares.`);
      }
    } catch (e) {
      console.warn(`X candidate drafting skipped (${e.message.slice(0, 120)}).`);
    }
  } else {
    console.log('No TAVILY_API_KEY set; outreach needs it for live search. Skipping.');
    return;
  }

  // Clean + flag. Keep everything (human decides), but mark flat or off-brand replies.
  const warnings = [];
  data.conversations = (data.conversations || []).map((c) => {
    const reply = scrub(c.reply);
    const stale = burnedIn(reply).length > 0;
    const mush = needsWork(reply) || stale;
    if (mush) warnings.push(`"${(c.title || '').slice(0, 40)}" reply ${stale ? 'reuses a worn-out phrase, reword before sending' : isStub(reply) ? 'is too clipped, give it an argument' : 'sounds flat, sharpen it'}.`);
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
