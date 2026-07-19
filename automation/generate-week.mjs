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
const DAYS_PER_WEEK = 7;
const MIN_DAYS = 5; // if fewer survive the guardrails, fail and re-run

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
  const tone = niche.content_tone || 'warm, real, dryly funny and confident';
  const keywords = (niche.niche_keywords || []).join(', ');
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  return `You are the automated communications assistant for Able2Love, writing as its founder: a Greater Manchester comedy writer, performer, musician and producer who is a full-time wheelchair user and a University of Salford Comedy Writing and Performance graduate. Performer first; the wheelchair is part of the picture, never the whole picture.

Able2Love is a genuine dating platform for disabled and non-disabled people who are open to dating one another. It exists because disability is too often allowed to define somebody before their humour, personality, attraction, ambition or individuality has entered the conversation. It is not a charity, pity project, fetish platform, medical forum or segregated space. Clear contrast suits the voice: say what something is and what it is not.

Tone: ${tone}
Topics we live in: ${keywords}
This week's theme: ${theme}

Plan ${DAYS_PER_WEEK} days of posting. Each day covers ONE subject (an "angle"), and you write that same subject two ways: a tight version for X and a fuller version for Instagram. The two must clearly be about the same idea, so the two platforms stay aligned.

For each day return an object with:
- "angle": 2 to 5 word label for the day's subject (internal only, e.g. "bad bios", "inaccessible venues").
- "x": the X/Twitter post. Max 260 characters including hashtags. Include a short engagement hook (a question or a "tag someone who..." line) so people reply, then 1 to 2 lowercase hashtags at the end.
- "headline": a short punchy line for the image card. Max 90 characters. No hashtags, no link.
- "caption": the Instagram caption. 2 to 4 sentences, warm and direct. End with a genuine engagement question or a "tag someone" prompt that invites replies, THEN point people to the app (e.g. "Free on Google Play, link in bio").
- "hashtags": 6 to 8 lowercase hashtags as an array (no # symbol), for Instagram. Mix broad and specific community tags. Always include "able2love". Good tags: disabilitydating, datingwithadisability, accessibledating, disabilitycommunity, disabilitypride, chronicillness, spoonie, invisibledisability, neurodivergent, actuallyautistic, deafcommunity, accessibility, wheelchairlife, inclusion. NEVER use fetish or model-bait tags such as wheelchairgirl or wheelchairmodel; a disability dating app must not court that audience.

Rules for ALL text:
- UK English spelling only (normalise, colour, maths).
- NEVER use an em dash or en dash. Use commas, brackets, colons or full stops.
- Vary the days: dry observations, a question to the community, a blunt joke, and about two days that plainly invite people to download the app.
- Humour may be dry, observational, dark or blunt. Good subjects: bad bios, weak opening messages, awkward dating behaviour, inaccessible venues, and the gap between what people claim and what they practise. Never make disabled bodies, care needs or private trauma the punchline. Disability does not need to be the subject of every joke.
- Treat disabled users as adults with attraction, preferences, boundaries, humour and agency. Never praise non-disabled people merely for being willing to date a disabled person.
- FACTS: never invent app features, release dates, prices, user numbers, testimonials, safety guarantees, partnerships, awards or statistics. The only product claims allowed: the app exists, it is free on Google Play, and what it stands for. Do not manufacture momentum.
- PRIVACY: never reference the founder's private life or health. Public facts only: performer, comedy writer, musician, producer, Salford graduate, wheelchair user, founder.
- Direct beats padded. Do not sound corporate, sentimental, over-inspirational, vague, or like an equality-and-diversity department.
- Never use pity or inspiration framing. Never use any of these words/phrases: ${banned}.

Before including a day, test it: Is it true? Is it specific? Does it sound like a real person? Does it centre agency rather than pity? Could the founder plausibly say it out loud? If any answer is no, rewrite it.

VARIETY, NON-NEGOTIABLE: a real person does not repeat catchphrases week after week. No two days may open the same way or share a signature phrase. These phrases are worn out from earlier posts and banned outright: "testimony", "the evidence", "warning label", "plot twist", "door policy", "all the right words", "vanishing act", "it's not you, it's me", "good deed", "feel-good story", "the gap". Find fresh images and fresh angles; the beliefs stay, the wording never repeats.

Return ONLY a JSON array of ${DAYS_PER_WEEK} day objects with keys angle, x, headline, caption, hashtags. No markdown, no commentary.`;
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
  { angle: 'why we built it', x: 'We got tired of dating apps that treat a disability like a plot twist. So we built one that does not. Able2Love is live, free on Google Play. Tag someone who has given up on the apps. #disabilitydating #able2love', headline: 'Dating apps were not built for us. So we built one.', caption: 'We got tired of dating apps that treat a disability like a plot twist you break gently in the DMs. So we built the one we actually wanted. Tag someone who has given up on the apps, this one is different. Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'inclusivedating', 'disabilitycommunity', 'disabilitypride', 'datingwithadisability'] },
  { angle: 'disclosure', x: 'Your disability should not be a speech you rehearse in the DMs. On Able2Love it is a card on your profile. Set it out once, done. What do you wish people just knew? #disabilitydating #able2love', headline: 'Your access needs. On a card, not a confession.', caption: 'On most apps your disability is a speech you rehearse in the DMs. On Able2Love it is a card on your profile. You set it out once, done. What do you wish people just knew so you did not have to explain it every time? Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'disabilitycommunity', 'invisibledisability', 'chronicillness', 'accessibility'] },
  { angle: 'bad bios', x: 'Red flag: "Love to laugh, love to travel, no drama." A personality, or an airport? Worst bio cliche you have seen? I will start. #disabilitydating #able2love', headline: '"Love to laugh, love to travel, no drama." A personality, or an airport?', caption: 'Green flags only: asks instead of assumes, does not treat access needs like a favour, knows a wheelchair is freedom not a tragedy. Worst bio cliche you have seen? I will start. Write a better bio. Free on Google Play, link in bio.', hashtags: ['able2love', 'disabilitydating', 'dating', 'greenflags', 'disabilitycommunity', 'neurodivergent'] },
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

// Photo search terms, deliberately 50/50 disabled and non-disabled people, warm
// and candid. Fed to Pexels at render time.
const PHOTO_QUERIES = [
  'wheelchair user smiling smartphone outdoors',
  'happy couple laughing looking at phone',
  'disabled woman smiling using smartphone',
  'young man smiling texting phone',
  'diverse friends laughing with phone',
  'wheelchair user couple happy together',
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
  return `Write a short, warm, believable dating-app exchange (3 messages) between two people on Able2Love, on the theme "${theme}". One of them has this access note on their profile: "${chip}". The access thing should come up lightly and naturally at most once (a step-free venue, a quiet place), never as the whole point, never as a hurdle. Real flirty banter, funny, kind. ${VOICE_LINE}
Return STRICT JSON: {"messages":["<msg1>","<msg2>","<msg3>"]}. Alternating speakers, msg1 and msg3 from the same person. Never use: ${banned}.`;
}
function flagsPrompt(theme, banned) {
  return `For an Able2Love "red flag vs green flags" card on the theme "${theme}". Give ONE cliche dating-bio red flag line (in quotes) with a dry one-line aside, and THREE green flags about respectful, decent behaviour towards a disabled date (short punchy phrases). ${VOICE_LINE}
Return STRICT JSON: {"redBio":"<a cliche bio line in quotes>","redAside":"<dry one-liner>","greens":["<g1>","<g2>","<g3>"]}. Never use: ${banned}.`;
}
function takePrompt(stat, theme, banned) {
  return `A real statistic: "${stat.stat} ${stat.claim}" (${stat.source}). Write Brogan's TAKE on it: 1 to 2 sentences, angry at the injustice and warm to the people, motivated and passionate, that ties to why Able2Love exists. Do NOT restate the number, do NOT invent any other number. ${VOICE_LINE}
Return STRICT JSON: {"take":"<the take>"}. Never use: ${banned}.`;
}

// Build a typed card item for day i. Best-effort extras; on any failure or
// guardrail trip, fall back to a warm statement card from the day's headline.
async function buildCard(day, i, theme, weekNo, banned, dryRun) {
  const type = TYPE_ROTA[i % TYPE_ROTA.length];
  const headline = scrubText(day.headline);
  const fallback = { type: 'statement', eyebrow: 'Able2Love', statement: headline };
  try {
    if (type === 'photo' || type === 'photoApp') {
      const q = PHOTO_QUERIES[i % PHOTO_QUERIES.length];
      const item = { type, caption: headline, imageQuery: q, eyebrow: null, tag: '#Able2Love' };
      if (type === 'photoApp') item.feature = APP_FEATURES[i % APP_FEATURES.length];
      return item;
    }
    if (type === 'statTake') {
      if (!hasStats()) return fallback;
      const stat = STATS_POOL[weekNo % STATS_POOL.length];
      let take = `That gap is exactly why Able2Love exists.`;
      if (!dryRun) {
        try { const r = await genJson(takePrompt(stat, theme, banned)); if (r.take) take = scrubText(r.take); } catch { /* keep default */ }
      }
      if (!cardClean(take, banned)) return fallback;
      return { type: 'statTake', eyebrow: stat.eyebrow, stat: stat.stat, claim: stat.claim, take, source: stat.source };
    }
    if (type === 'split') {
      const [a, b] = NAME_PAIRS[weekNo % NAME_PAIRS.length];
      const chip = ACCESS_CHIPS[weekNo % ACCESS_CHIPS.length];
      let messages = ['Your bio actually made me laugh out loud', 'Low bar for men, high bar for jokes', 'Coffee this week? Somewhere step-free, I already checked'];
      if (!dryRun) {
        try { const r = await genJson(chatPrompt(theme, chip, banned)); if (Array.isArray(r.messages) && r.messages.length >= 2) messages = r.messages.slice(0, 3).map(scrubText); } catch { /* keep default */ }
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
  for (const d of days || []) {
    const angle = String(d.angle || '').trim();
    const x = String(d.x || '').trim();
    const headline = String(d.headline || '').trim();
    const caption = String(d.caption || '').trim();
    const hashtags = Array.isArray(d.hashtags) ? d.hashtags.map(String) : [];
    if (!x || !headline || !caption) continue;

    const blob = `${x} ${headline} ${caption} ${hashtags.join(' ')}`;
    const violation = findViolation(blob, banned);
    if (violation) { console.warn(`Dropped a day (banned phrase "${violation}"): ${angle}`); continue; }
    if (BANNED_CHARACTERS.some((ch) => blob.includes(ch))) { console.warn(`Dropped a day (em/en dash): ${angle}`); continue; }
    if (x.length > 275) { console.warn(`Dropped a day (X post ${x.length} chars): ${angle}`); continue; }
    if (headline.length > 100) { console.warn(`Dropped a day (headline too long): ${angle}`); continue; }

    approved.push({ angle, x, headline, caption, hashtags });
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
  lines.push('One subject a day, posted to BOTH Instagram and X at your peak time, same image both places. Instagram uses the longer caption, X uses the tight version. Review, then load into Buffer, or hand this folder to the Claude browser extension.');
  lines.push('');
  approved.forEach((d, i) => {
    const img = path.basename(cardFiles[i]);
    lines.push(`## Day ${i + 1} — ${d.angle}`);
    lines.push(`**Image:** \`${img}\``);
    lines.push('');
    lines.push('**Instagram:**');
    lines.push('```');
    lines.push(`${d.caption}\n\n${d.hashtags.map((h) => '#' + h).join(' ')}`);
    lines.push('```');
    lines.push('**X:**');
    lines.push('```');
    lines.push(d.x);
    lines.push('```');
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
