#!/usr/bin/env node
/**
 * Able2Love content brain, tandem edition.
 *
 * Generates ONE week of aligned content: 7 days, and each day carries a
 * matched pair of posts on the SAME subject, one for X and one for Instagram,
 * plus a branded card image used on both platforms. So Instagram and X move
 * in lockstep, one theme a day, at peak time.
 *
 * Runs weekly on GitHub Actions (free), gets reviewed by a human, then loaded
 * into Buffer (free) for posting.
 *
 * Output (content-queue/):
 *   week-<date>/schedule.md   the tandem plan: per day, IG caption + X caption
 *   week-<date>/card-0N.png   the image for day N (same image on both platforms)
 *
 * Usage:
 *   GEMINI_API_KEY=... node automation/generate-week.mjs
 *   node automation/generate-week.mjs --dry-run   (no API call, sample week)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCards } from './lib/render-cards.mjs';
import { generateText } from './lib/llm.mjs';
import { lessonsPromptBlock } from './lib/lessons.mjs';
import { STATS_POOL, hasStats } from './lib/stats-pool.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue');

const PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.abletolove.app';
// Raw base so the review issue can SHOW each card image (committed just before
// the issue is opened), instead of printing the filename.
const REPO_RAW = 'https://raw.githubusercontent.com/btf123/abletolove/main';
const DAYS_PER_WEEK = 7;
const MIN_DAYS = 5; // if fewer survive the guardrails, fail and re-run

// Render text as a Markdown blockquote so it WRAPS in the review issue (a code
// fence forces a horizontal scrollbar, which is the slider the founder hates).
function quoteBlock(text) {
  return String(text || '').split('\n').map((l) => (l.trim() ? `> ${l}` : '>')).join('\n');
}

// One theme per week, rotating forever. Both platforms share it.
const THEMES = [
  'the relief of not having to explain yourself on a dating app',
  'green flags and what respectful curiosity looks like',
  'accessibility as a feature mainstream apps forgot',
  'funny, relatable moments from dating with a disability',
  'community stories and belonging',
  'chronic illness and dating honestly',
  'neurodivergent dating and communication styles',
  'myths about disabled people and relationships, gently debunked',
];

const DEFAULT_BANNED = [
  'suffers from', 'afflicted', 'confined to a wheelchair', 'wheelchair-bound',
  'special needs', 'differently abled', 'handicapable', 'overcame',
  'despite her disability', 'despite his disability', 'despite their disability',
  'inspiring us all', 'brave', 'passionate', 'empowering', 'transformative',
  'inspirational', 'journey to love',
];

// Formatting the founder has explicitly outlawed in public copy.
const BANNED_CHARACTERS = ['—', '–']; // em dash, en dash

// Formula frames and committee-speak that make posts read like a brand, not
// Brogan. A caption using any of these is dropped, and the retry loop generates
// a fresh, differently-shaped one in its place.
const WEEKLY_RETIRED = [
  'the real story is', 'the test is not about', "it's not about", 'it is not about',
  'part of this movement', 'more inclusive community', 'more inclusive world',
  'game-changer', 'game changer', "let's make it happen", "let's break it",
  'share your stories', 'what changes would you like', 'have you experienced',
  'regardless of ability', 'let us', 'we must',
  // Second-generation crutches the model reached for once the first were banned:
  'what if we could', 'what if you could', 'create a space where',
  'make that a reality', 'one venue at a time', 'one profile at a time',
  'leading the charge', 'changing the game', 'is here to help', 'we could create',
  'working to change', 'working to make', 'more inclusive nightlife',
];

// Normalise a caption/X post and return its word runs, stripping the constant
// CTA, app name and hashtags. Used to catch ANY repeated skeleton across a week,
// not just phrases we thought to ban.
function phraseGrams(text, n = 5) {
  let t = String(text || '').toLowerCase();
  t = t.replace(/#[a-z0-9_]+/g, ' ')
    .replace(/free on google play[^.]*/g, ' ')
    .replace(/link in bio/g, ' ')
    .replace(/able2love/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const w = t.split(' ').filter(Boolean);
  const grams = [];
  for (let i = 0; i + n <= w.length; i++) grams.push(w.slice(i, i + n).join(' '));
  return grams;
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - start) / 86400000 + 1) / 7);
}

function findViolation(text, banned) {
  const hay = text.toLowerCase();
  for (const phrase of banned) if (hay.includes(phrase.toLowerCase())) return phrase;
  return null;
}

function buildPrompt(niche, theme) {
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  return `You write Able2Love's Instagram and X posts AS ITS FOUNDER, Brogan: a Greater Manchester comedy writer, performer and musician who is a full-time wheelchair user. You are a real, funny, opinionated person, not a brand account and not an AI. Performer first; the wheelchair is part of the picture, never the whole picture.

Able2Love is a dating app for disabled and non-disabled people who want to date each other. You built it because the mainstream apps treat a disability like a dealbreaker and disabled people get shut out of so much of normal social life. That injustice is what fires you up.

YOUR VOICE, THIS IS THE WHOLE POINT, GET IT RIGHT:
- Warm and on the community's side, but with a real edge. You HAVE opinions and you are not shy about them.
- You are angry, and the anger is aimed at the barriers: the mainstream apps, the venues with steps, the people who look away. NEVER at disabled people. Motivated by that anger, never sunk by it.
- Dry, funny, human. A joke, a sharp observation, a blunt truth. Like a comedian who happens to have built the app.
- Every post is a different shape, but they all come back to one belief: the way disabled people get treated on dating apps and shut out of social life is wrong, and Able2Love is here to change it. This is a sea change, and you talk like it.
- BRING THE LIVED, PERSONAL COST. Not just "this venue has steps", but what those steps take from you: the places you'll never get to see, the nights out you're shut out of, the experiences quietly denied. First person, specific, wistful and angry at the same time. This is the mindset that makes people feel it. Example: a photo of a grand staircase with the line "Steps to nowhere. Another place I'll never get to see." That ache, paired with the anger, is the voice.
- First person is good ("I built this because", "we"). Specific and lived. Never a charity, never an equality-and-diversity department, never inspiration-porn.

DEAD ON ARRIVAL, never write like this: faceless engagement-bait such as "Share your stories", "What changes would you like to see?", "Have you experienced X? How did you handle it?", "Let's celebrate the venues that get it right", "X can be tough, but what if...", "Nightlife should be for everyone, regardless of ability". These are limp and could come from any brand's social calendar. If a line isn't unmistakably YOU, bin it and say it like a person with a pulse.

BANNED STRUCTURE, do not build posts this way: the arc "here's a problem... but what if we could create a space where...... Able2Love is working to make that a reality" is DEAD. Do not use "what if we could", "create a space where", "make that a reality", "one venue at a time", "leading the charge". Do NOT end every post with an Able2Love-will-fix-it promise. Vary the shape completely: some posts are just a blunt observation or a joke and stop; some end on the ache with no tidy resolution; only SOME mention the app, and when you do, word it differently every single time. No two posts may end the same way or use the same skeleton.

Plan ${DAYS_PER_WEEK} days, this week's theme: ${theme}. Each day is ONE subject (an "angle"), written two ways: a tight version for X and a fuller one for Instagram, clearly the same idea.

For each day return an object with:
- "angle": 2 to 5 word internal label (e.g. "bad bios", "nightclub stairs").
- "headline": a short punchy line for the image card, max 90 characters, no hashtags, in your voice. Where it fits, carry the lived cost in two beats: the thing, then what it takes from you (e.g. "Steps to nowhere. Another place I'll never get to see.").
- "x": the X post, max 260 chars including hashtags. Make a point or a joke FIRST. A question is optional; if you use one it must be specific and human, never the generic bait above. End with 1 to 2 lowercase hashtags.
- "caption": the Instagram caption, 2 to 4 sentences in your voice. Land the point, then point to the app naturally (e.g. "Free on Google Play, link in bio"). No generic bait.
- "hashtags": 6 to 8 lowercase hashtags (no # symbol). Always include "able2love". Good: disabilitydating, datingwithadisability, accessibledating, disabilitycommunity, disabilitypride, chronicillness, spoonie, invisibledisability, neurodivergent, actuallyautistic, deafcommunity, accessibility, wheelchairlife, inclusion. NEVER fetish or model-bait tags (wheelchairgirl, wheelchairmodel).
- "image_query": a short, literal stock-photo search phrase (3 to 6 words) for a REAL photo that MATCHES this day's subject, so the picture actually illustrates the post. Show the real scene or thing:
    * people connecting, dating, a couple, honesty between two people: feature disabled and non-disabled people together, e.g. "wheelchair user couple laughing cafe".
    * a barrier or a place (inaccessible venue, nightclub with steps, bar with no ramp): show the BARRIER itself, kept GENERIC, e.g. "steep staircase entrance", "steps at a doorway", "bar with steps no ramp", "narrow doorway". NEVER a named, famous or recognisable venue: we illustrate the problem, we never call out a real place.
    * a feeling or a person on their own (energy limits, disclosure nerves): show that, e.g. "tired woman resting on sofa", "person nervous looking at phone".
  Concrete and searchable, no abstract words, and it must obviously relate to the caption. Do NOT default to "happy couple on phone" unless the post is genuinely about that.

Rules for ALL text:
- UK English only. NEVER an em dash or en dash; use commas, brackets, colons, full stops.
- Never make disabled bodies, care needs or private trauma the punchline. Disability is context, not the joke.
- Treat disabled people as adults with attraction, humour and agency. Never praise non-disabled people just for dating a disabled person.
- FACTS: never invent app features, prices, user numbers, testimonials, awards or statistics. Only true product claims: the app exists, it's free on Google Play, and what it stands for.
- PRIVACY: never reference the founder's private life or health. Public facts only: performer, comedy writer, musician, wheelchair user, founder.
- Never pity or inspiration framing. Never use: ${banned}.

VARIETY, NON-NEGOTIABLE: EVERY caption must OPEN differently. Do not reuse a sentence frame across the week. These frames are banned outright, do not use ANY of them even once: "The real story is...", "The test is not about...", "It is not about X, it's about Y", "part of this movement", "a more inclusive community", "a more inclusive world", "game-changer", "let's make it happen", "let's break it". Also retired: "testimony", "the evidence", "warning label", "plot twist", "door policy", "all the right words", "vanishing act", "it's not you, it's me", "good deed", "feel-good story", "the gap". Open each day a different way: a blunt line, a joke, a specific gripe, a flat statement of fact, a bit of anger. The belief stays; the wording and the shape never repeat.

Return ONLY a JSON array of ${DAYS_PER_WEEK} day objects with keys angle, headline, x, caption, hashtags, image_query. No markdown, no commentary.`;
}

function parseDays(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in model output');
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('Model output is not an array');
  return arr;
}

const SAMPLE_WEEK = [
  { angle: 'why we built it', x: 'We got tired of dating apps that treat a disability like a plot twist. So we built one that does not. Able2Love is live, free on Google Play. Tag someone who has given up on the apps. #disabilitydating #able2love', headline: 'Dating apps were not built for us. So we built one.', caption: 'We got tired of dating apps that treat a disability like a plot twist you break gently in the DMs. So we built the one we actually wanted. Tag someone who has given up on the apps, this one is different. Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'inclusivedating', 'disabilitycommunity', 'disabilitypride', 'datingwithadisability'], image_query: 'wheelchair user couple laughing together' },
  { angle: 'disclosure', x: 'Your disability should not be a speech you rehearse in the DMs. On Able2Love it is a card on your profile. Set it out once, done. What do you wish people just knew? #disabilitydating #able2love', headline: 'Your access needs. On a card, not a confession.', caption: 'On most apps your disability is a speech you rehearse in the DMs. On Able2Love it is a card on your profile. You set it out once, done. What do you wish people just knew so you did not have to explain it every time? Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'disabilitycommunity', 'invisibledisability', 'chronicillness', 'accessibility'], image_query: 'person looking at phone thoughtful' },
  { angle: 'bad bios', x: 'Red flag: "Love to laugh, love to travel, no drama." A personality, or an airport? Worst bio cliche you have seen? I will start. #disabilitydating #able2love', headline: '"Love to laugh, love to travel, no drama." A personality, or an airport?', caption: 'Green flags only: asks instead of assumes, does not treat access needs like a favour, knows a wheelchair is freedom not a tragedy. Worst bio cliche you have seen? I will start. Write a better bio. Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'dating', 'greenflags', 'disabilitycommunity', 'neurodivergent'], image_query: 'airport departure board crowd' },
];

// ---------------------------------------------------------------------------
// Card-type assembly. Instead of seven identical text squares, each day becomes
// a different, captivating card TYPE (photo, split-screen, stat+take, etc). The
// day's written headline/caption feed the card; a few types need a little extra
// structured content, generated best-effort with a fallback that never breaks
// the week.
// ---------------------------------------------------------------------------

// The weekly mix. Leads with the manifesto, alternates photo-led and designed
// cards so a scroll never sees two of the same in a row.
const TYPE_ROTA = ['statement', 'photo', 'split', 'statTake', 'flags', 'photoApp', 'photo'];

// FALLBACK photo queries, used only when the day has no topic-matched
// image_query. The primary source is each day's own image_query, so the picture
// illustrates that post. These still lean on visible disability + interabled
// pairs so a fallback never lands on random able-bodied stock.
const PHOTO_QUERIES = [
  'wheelchair couple love',
  'interabled couple smiling',
  'down syndrome friends smiling',
  'blind person white cane',
  'deaf couple sign language',
  'wheelchair user friends laughing',
  'woman walking cane smiling',
  'disabled non disabled friends together',
];
// App screenshots available for the photoApp/feature overlays.
const APP_FEATURES = ['disclosure', 'nearby', 'plandate'];
// Rotating pairings for the split-screen card: varied names and genders.
const NAME_PAIRS = [
  [{ name: 'Maya', initial: 'M', grad: ['#B23AD8', '#E23349'] }, { name: 'Tom', initial: 'T', grad: ['#FF8FA6', '#FFC64D'] }],
  [{ name: 'Priya', initial: 'P', grad: ['#E23349', '#FF8FA6'] }, { name: 'Jess', initial: 'J', grad: ['#B23AD8', '#8E24AA'] }],
  [{ name: 'Leo', initial: 'L', grad: ['#FFC64D', '#E23349'] }, { name: 'Sam', initial: 'S', grad: ['#B23AD8', '#FF8FA6'] }],
  [{ name: 'Aisha', initial: 'A', grad: ['#E23349', '#B23AD8'] }, { name: 'Danny', initial: 'D', grad: ['#FF8FA6', '#FFC64D'] }],
];
const ACCESS_CHIPS = ['Wheelchair user', 'Chronic illness', 'Deaf', 'Neurodivergent', 'Uses a cane'];

// Honest alt text per card type, for accessibility.
function altFor(d) {
  const h = d.headline || '';
  switch (d.cardType) {
    case 'photo':
    case 'photoApp':
      return `A branded Able2Love photo card. Caption: "${h}"`;
    case 'split':
      return 'An Able2Love card showing two phones side by side with a friendly dating-app conversation, one profile noting an access need.';
    case 'statTake':
      return `An Able2Love statistic card with the founder's take. Headline: "${h}"`;
    case 'flags':
      return `An Able2Love red-flag versus green-flags card about respectful dating. Headline: "${h}"`;
    case 'feature':
      return `An Able2Love card showing an app screenshot. Caption: "${h}"`;
    default:
      return `A branded Able2Love card that reads: "${h}"`;
  }
}
function scrubText(s) {
  let t = String(s || '');
  for (const ch of BANNED_CHARACTERS) t = t.split(ch).join(', ');
  return t.trim();
}
// Keep card text inside the card. Trims to at most `maxSentences` and `maxChars`,
// cutting on a sentence or word boundary so nothing overflows the design.
function clamp(s, maxSentences, maxChars) {
  let t = scrubText(s).replace(/\s+/g, ' ');
  const parts = t.match(/[^.!?]+[.!?]+/g);
  if (parts && parts.length > maxSentences) t = parts.slice(0, maxSentences).join(' ').trim();
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars);
    const sp = cut.lastIndexOf(' ');
    t = (sp > 40 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '');
    if (!/[.!?]$/.test(t)) t += '.';
  }
  return t;
}
function cardClean(blob, banned) {
  const v = findViolation(blob, banned);
  if (v) return false;
  if (BANNED_CHARACTERS.some((ch) => blob.includes(ch))) return false;
  return true;
}

function parseJsonLoose(raw) {
  const cleaned = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('no JSON object');
  try { return JSON.parse(cleaned.slice(s, e + 1)); }
  catch { return JSON.parse(cleaned.slice(s, e + 1).replace(/,(\s*[}\]])/g, '$1')); }
}
async function genJson(prompt) {
  return parseJsonLoose(await generateText(prompt, { temperature: 0.9 }));
}

const VOICE_LINE = 'Voice: warm, human, dryly funny, angry at the barriers not the people, professional but with a pulse. UK English. Never an em dash or en dash. Never make disabled people the punchline. Never invent statistics or app features.';

function chatPrompt(theme, chip, banned) {
  return `Write a short, warm, believable dating-app exchange (3 messages) between two people on Able2Love, on the theme "${theme}". One of them has this access note on their profile: "${chip}". The access thing should come up lightly and naturally at most once (a step-free venue, a quiet place), never as the whole point, never as a hurdle. Real flirty banter, funny, kind. Keep EACH message SHORT, like a real text: ideally under 80 characters, never more than 120. ${VOICE_LINE}
Return STRICT JSON: {"messages":["<msg1>","<msg2>","<msg3>"]}. Alternating speakers, msg1 and msg3 from the same person. Never use: ${banned}.`;
}
function flagsPrompt(theme, banned) {
  return `For an Able2Love "red flag vs green flags" card on the theme "${theme}". Give ONE cliche dating-bio red flag line (in quotes) with a dry one-line aside, and THREE green flags about respectful, decent behaviour towards a disabled date (short punchy phrases). ${VOICE_LINE}
Return STRICT JSON: {"redBio":"<a cliche bio line in quotes>","redAside":"<dry one-liner>","greens":["<g1>","<g2>","<g3>"]}. Never use: ${banned}.`;
}
function takePrompt(stat, theme, banned) {
  return `A real statistic: "${stat.stat} ${stat.claim}" (${stat.source}). Write Brogan's TAKE on it: SHORT, punchy, at most 2 sentences and under 150 characters total, angry at the injustice and warm to the people, that ties to why Able2Love exists. Do NOT restate the number, do NOT invent any other number, do NOT write a paragraph. ${VOICE_LINE}
Return STRICT JSON: {"take":"<the take, under 150 characters>"}. Never use: ${banned}.`;
}

// Build a typed card item for day i. Best-effort extras; on any failure or
// guardrail trip, fall back to a warm statement card from the day's headline.
async function buildCard(day, i, theme, weekNo, banned, dryRun) {
  let type = TYPE_ROTA[i % TYPE_ROTA.length];
  // A post about a physical barrier or venue should SHOW that barrier, not land
  // on a chat/stat card. If the day is barrier-shaped and we have a query for it,
  // force a photo card so the picture illustrates the problem.
  const barrier = /\b(venue|nightclub|night club|club|nightlife|stair|stairs|step|steps|ramp|inaccessible|entrance|doorway|building|toilet|lift|pub|bar|dancefloor|dance floor)\b/i.test(`${day.angle} ${day.imageQuery} ${day.headline}`);
  if (barrier && day.imageQuery && day.imageQuery.length >= 4 && type !== 'photoApp') type = 'photo';
  const headline = scrubText(day.headline);
  const fallback = { type: 'statement', eyebrow: 'Able2Love', statement: headline };
  try {
    if (type === 'photo' || type === 'photoApp') {
      // Prefer the day's own topic-matched query so the photo illustrates the
      // actual post; the fixed representation list is only a last-resort fallback.
      const q = (day.imageQuery && day.imageQuery.length >= 4) ? day.imageQuery : PHOTO_QUERIES[i % PHOTO_QUERIES.length];
      const item = { type, caption: headline, imageQuery: q, eyebrow: null, tag: '#Able2Love', photoPick: weekNo };
      if (type === 'photoApp') item.feature = APP_FEATURES[i % APP_FEATURES.length];
      return item;
    }
    if (type === 'statTake') {
      if (!hasStats()) return fallback;
      const stat = STATS_POOL[weekNo % STATS_POOL.length];
      let take = `That gap is exactly why Able2Love exists.`;
      if (!dryRun) {
        try { const r = await genJson(takePrompt(stat, theme, banned)); if (r.take) take = clamp(r.take, 2, 150); } catch { /* keep default */ }
      }
      if (!cardClean(take, banned)) return fallback;
      return { type: 'statTake', eyebrow: stat.eyebrow, stat: stat.stat, claim: stat.claim, take, source: stat.source };
    }
    if (type === 'split') {
      const [a, b] = NAME_PAIRS[weekNo % NAME_PAIRS.length];
      const chip = ACCESS_CHIPS[weekNo % ACCESS_CHIPS.length];
      let messages = ['Your bio actually made me laugh out loud', 'Low bar for men, high bar for jokes', 'Coffee this week? Somewhere step-free, I already checked'];
      if (!dryRun) {
        try { const r = await genJson(chatPrompt(theme, chip, banned)); if (Array.isArray(r.messages) && r.messages.length >= 2) messages = r.messages.slice(0, 3).map((m) => clamp(m, 2, 120)); } catch { /* keep default */ }
      }
      if (!cardClean(messages.join(' '), banned)) return fallback;
      return { type: 'split', personA: { ...a, chip }, personB: { ...b }, messages };
    }
    if (type === 'flags') {
      let f = { redBio: '"Love to laugh, love to travel, no drama."', redAside: 'A personality, or an airport?', greens: ['Asks instead of assumes', "Doesn't treat access needs like a favour", 'Knows a wheelchair is freedom, not a tragedy'] };
      if (!dryRun) {
        try { const r = await genJson(flagsPrompt(theme, banned)); if (r.redBio && Array.isArray(r.greens) && r.greens.length >= 3) f = { redBio: scrubText(r.redBio), redAside: scrubText(r.redAside), greens: r.greens.slice(0, 3).map(scrubText) }; } catch { /* keep default */ }
      }
      if (!cardClean(`${f.redBio} ${f.redAside} ${f.greens.join(' ')}`, banned)) return fallback;
      return { type: 'flags', ...f };
    }
    // statement (and anything else): the day's headline as the belief line.
    return { type: 'statement', eyebrow: 'Able2Love', statement: headline };
  } catch {
    return fallback;
  }
}

// One generation attempt: draft the week and parse it, with a single repair pass
// for the usual dropped-comma slip. Throws if it still won't parse (the caller
// retries with a fresh draft).
async function generateWeekDays(niche, theme, lessonsBlock) {
  const raw = await generateText(buildPrompt(niche, theme) + lessonsBlock, { temperature: 0.9 });
  try {
    return parseDays(raw);
  } catch (err) {
    console.warn(`Week JSON parse failed (${err.message}); asking the model to repair it.`);
    const repaired = await generateText(`The text below was meant to be one strict JSON array of day objects but does not parse (${err.message}). Return ONLY the corrected JSON array: no markdown, no commentary, and escape any double quotes inside string values.\n\n${raw}`, { temperature: 0.3 });
    return parseDays(repaired);
  }
}

// Filter a raw day list down to the ones that pass the public-copy guardrails.
function approveDays(days, banned) {
  const approved = [];
  const seenGrams = new Set(); // 5-word runs already used this week
  for (const d of days || []) {
    const angle = String(d.angle || '').trim();
    const x = String(d.x || '').trim();
    const headline = String(d.headline || '').trim();
    const caption = String(d.caption || '').trim();
    const hashtags = Array.isArray(d.hashtags) ? d.hashtags.map(String) : [];
    const imageQuery = String(d.image_query || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!x || !headline || !caption) continue;

    const blob = `${x} ${headline} ${caption} ${hashtags.join(' ')}`;
    const violation = findViolation(blob, banned);
    if (violation) { console.warn(`Dropped a day (banned phrase "${violation}"): ${angle}`); continue; }
    const formula = findViolation(`${x} ${caption}`, WEEKLY_RETIRED);
    if (formula) { console.warn(`Dropped a day (formula/committee-speak "${formula}"): ${angle}`); continue; }
    if (BANNED_CHARACTERS.some((ch) => blob.includes(ch))) { console.warn(`Dropped a day (em/en dash): ${angle}`); continue; }
    if (x.length > 275) { console.warn(`Dropped a day (X post ${x.length} chars): ${angle}`); continue; }
    if (headline.length > 100) { console.warn(`Dropped a day (headline too long): ${angle}`); continue; }

    // Auto repeat-catcher: if this day reuses a 5-word run from an earlier day,
    // it's the same skeleton in fresh clothes. Drop it; the retry loop will
    // regenerate a differently-shaped one.
    const grams = [...phraseGrams(caption), ...phraseGrams(x)];
    const echo = grams.find((g) => seenGrams.has(g));
    if (echo) { console.warn(`Dropped a day (repeats "${echo}" from an earlier day): ${angle}`); continue; }
    grams.forEach((g) => seenGrams.add(g));

    approved.push({ angle, x, headline, caption, hashtags, imageQuery });
  }
  return approved;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  const now = new Date();
  const weekNo = isoWeek(now);
  const theme = THEMES[weekNo % THEMES.length];
  console.log(`Theme this week (both platforms): ${theme}`);

  let approved;
  if (dryRun) {
    approved = approveDays(SAMPLE_WEEK, banned);
  } else {
    // The model occasionally hands back mangled JSON, and after the repair pass
    // too few days survive the guardrails. Rather than fail the whole run (and
    // make the founder re-trigger by hand), regenerate a few times; a fresh draft
    // almost always parses cleanly. Only give up after several honest attempts.
    const lessonsBlock = await lessonsPromptBlock();
    const MAX_ATTEMPTS = 4;
    approved = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const days = await generateWeekDays(niche, theme, lessonsBlock);
        approved = approveDays(days, banned);
      } catch (e) {
        console.warn(`Week generation attempt ${attempt} threw: ${e.message.slice(0, 140)}`);
        approved = [];
      }
      if (approved.length >= MIN_DAYS) { console.log(`Attempt ${attempt}: ${approved.length} aligned days survived.`); break; }
      console.warn(`Attempt ${attempt}: only ${approved.length} day(s) survived the guardrails (need ${MIN_DAYS}).${attempt < MAX_ATTEMPTS ? ' Regenerating.' : ''}`);
    }
    if (approved.length < MIN_DAYS) {
      console.error(`Gave up after ${MAX_ATTEMPTS} attempts: only ${approved.length} aligned days survived (need ${MIN_DAYS}).`);
      process.exit(1);
    }
  }

  const stamp = now.toISOString().slice(0, 10);
  const weekDir = path.join(OUT_DIR, `week-${stamp}`);

  // Turn each approved day into a captivating, typed card (photo, split-screen,
  // stat+take, flags, statement...) instead of a plain text square. Best-effort
  // extras; a failure falls back to a warm statement card, never a broken week.
  const cardItems = [];
  for (let i = 0; i < approved.length; i++) {
    cardItems.push(await buildCard(approved[i], i, theme, weekNo, banned, dryRun));
    approved[i].cardType = cardItems[i].type;
  }
  console.log(`Card mix: ${cardItems.map((c) => c.type).join(', ')}`);
  const cardFiles = await renderCards(cardItems, weekDir); // card-01.png ... in weekDir

  const lines = [];
  lines.push(`# Able2Love week: ${stamp} (Instagram + X, in tandem)`);
  lines.push('');
  lines.push(`Theme: **${theme}**`);
  lines.push('');
  lines.push('One subject a day, posted to BOTH Instagram and X at your peak time, same image both places. This is your review copy: the actual card image and the full caption for each day are below. If anything is off, say so before it goes out.');
  lines.push('');
  approved.forEach((d, i) => {
    const img = path.basename(cardFiles[i]);
    lines.push(`## Day ${i + 1} — ${d.angle}`);
    lines.push('');
    // Show the real card, not its filename.
    lines.push(`![Day ${i + 1} card](${REPO_RAW}/content-queue/week-${stamp}/${img})`);
    lines.push('');
    lines.push('**Instagram caption:**');
    lines.push('');
    lines.push(quoteBlock(`${d.caption}\n\n${d.hashtags.map((h) => '#' + h).join(' ')}`));
    lines.push('');
    lines.push('**X post:**');
    lines.push('');
    lines.push(quoteBlock(d.x));
    lines.push('');
    lines.push(`**Alt text:** ${altFor(d)}`);
    lines.push('');
  });
  lines.push('---');
  lines.push(`App link for bios and plugs: ${PLAY_LINK}`);
  lines.push('');

  await mkdir(weekDir, { recursive: true });
  await writeFile(path.join(weekDir, 'schedule.md'), lines.join('\n'));

  // Machine-readable copy for the auto-publisher (automation/publish-today.mjs).
  // approved:false is the weekly veto: nothing from this batch posts until the
  // founder reviews it and runs the "Approve this week" workflow (or edits this
  // flag). Older batches with no `approved` field keep posting, for safety.
  const weekJson = {
    start: stamp, // day 1 posts on this date
    approved: false,
    theme,
    days: approved.map((d, i) => ({
      day: i + 1,
      angle: d.angle,
      card: path.basename(cardFiles[i]),
      x: d.x,
      instagram: `${d.caption}\n\n${d.hashtags.map((h) => '#' + h).join(' ')}`,
      alt: altFor(d),
      hold: false, // set true on a day to keep the publisher's hands off it
    })),
  };
  await writeFile(path.join(weekDir, 'week.json'), JSON.stringify(weekJson, null, 2));
  console.log(`Wrote ${approved.length} aligned days (IG + X) with cards to ${path.relative(ROOT, weekDir)}`);
}

main().catch((error) => {
  console.error('Content brain failed:', error);
  process.exit(1);
});
