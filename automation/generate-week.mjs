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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue');

const PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.abletolove.app';
const DAYS_PER_WEEK = 7;
const MIN_DAYS = 5; // if fewer survive the guardrails, fail and re-run
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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

Return ONLY a JSON array of ${DAYS_PER_WEEK} day objects with keys angle, x, headline, caption, hashtags. No markdown, no commentary.`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY is not set. Add it as a repository secret (see marketing/07-free-bot.md).');
    process.exit(1);
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no text');
      return text;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastError;
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  const now = new Date();
  const theme = THEMES[isoWeek(now) % THEMES.length];
  console.log(`Theme this week (both platforms): ${theme}`);

  let days = dryRun ? SAMPLE_WEEK : parseDays(await callGemini(buildPrompt(niche, theme)));

  const approved = [];
  for (const d of days) {
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

  if (!dryRun && approved.length < MIN_DAYS) {
    console.error(`Only ${approved.length} aligned days survived the guardrails (need ${MIN_DAYS}). Not writing. Re-run the workflow.`);
    process.exit(1);
  }

  const stamp = now.toISOString().slice(0, 10);
  const weekDir = path.join(OUT_DIR, `week-${stamp}`);
  const cardFiles = await renderCards(approved, weekDir); // card-01.png ... in weekDir

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
    lines.push(`**Alt text:** Text on a dark Able2Love card that reads: "${d.headline}"`);
    lines.push('');
  });
  lines.push('---');
  lines.push(`App link for bios and plugs: ${PLAY_LINK}`);
  lines.push('');

  await mkdir(weekDir, { recursive: true });
  await writeFile(path.join(weekDir, 'schedule.md'), lines.join('\n'));

  // Machine-readable copy for the auto-publisher (automation/publish-today.mjs).
  const weekJson = {
    start: stamp, // day 1 posts on this date
    theme,
    days: approved.map((d, i) => ({
      day: i + 1,
      angle: d.angle,
      card: path.basename(cardFiles[i]),
      x: d.x,
      instagram: `${d.caption}\n\n${d.hashtags.map((h) => '#' + h).join(' ')}`,
      alt: `Text on a dark Able2Love card that reads: "${d.headline}"`,
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
