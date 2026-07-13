#!/usr/bin/env node
/**
 * Able2Love content brain.
 *
 * Generates a week of on-brand social posts with Google Gemini (free tier),
 * runs them through the brand guardrails, and writes a ready-to-paste batch
 * file into content-queue/. Run weekly by GitHub Actions (free), reviewed by
 * a human, then loaded into Buffer (free) for actual posting.
 *
 * Usage:
 *   GEMINI_API_KEY=... node automation/generate-posts.mjs
 *   node automation/generate-posts.mjs --dry-run   (no API call, sample posts)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue');

const SITE_LINK = 'able2love.netlify.app';
const PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.abletolove.app';
const POSTS_PER_BATCH = 7;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// One theme per week, rotating forever.
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
const BANNED_CHARACTERS = ['\u2014', '\u2013']; // em dash, en dash

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - start) / 86400000 + 1) / 7);
}

function findViolation(text, banned) {
  const hay = text.toLowerCase();
  for (const phrase of banned) {
    if (hay.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function buildPrompt(niche, theme) {
  const tone = niche.content_tone || 'warm, real, and confident';
  const keywords = (niche.niche_keywords || []).join(', ');
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  return `You are the automated communications assistant for Able2Love, writing as its founder: a Greater Manchester comedy writer, performer, musician and producer who is a full-time wheelchair user and a University of Salford Comedy Writing and Performance graduate. Performer first; the wheelchair is part of the picture, never the whole picture.

Able2Love is a genuine dating platform for disabled and non-disabled people who are open to dating one another. It exists because disability is too often allowed to define somebody before their humour, personality, attraction, ambition or individuality has entered the conversation. It is not a charity, pity project, fetish platform, medical forum or segregated space. Clear contrast suits the voice: say what something is and what it is not.

Tone: ${tone}
Topics we live in: ${keywords}
This week's theme: ${theme}

Write ${POSTS_PER_BATCH} posts for X (Twitter). Rules:
- UK English spelling only (normalise, colour, maths).
- NEVER use an em dash or en dash. Use commas, brackets, colons or full stops.
- Max 240 characters each, including hashtags.
- 1-2 hashtags per post, lowercase, no more.
- Vary the format: dry observations, questions to the community, blunt jokes, one clear app plug.
- Exactly two of the posts should invite people to download the app; end those with "${SITE_LINK}".
- The rest should be community-first with no link.
- Humour may be dry, observational, dark or slightly blunt. Good subjects: bad bios, weak opening messages, awkward dating behaviour, inaccessible venues, and the gap between what people claim and what they practise. Never make disabled bodies, care needs or private trauma the punchline. Disability does not need to be the subject of every joke.
- Treat disabled users as adults with attraction, preferences, boundaries, humour and agency. Never praise non-disabled people merely for being willing to date a disabled person.
- FACTS: never invent app features, release dates, prices, user numbers, testimonials, safety guarantees, partnerships, awards or statistics. The only product claims allowed: the app exists, it is free on Google Play, and what it stands for. Do not manufacture momentum.
- PRIVACY: never reference the founder's private life or health. Public facts only: performer, comedy writer, musician, producer, Salford graduate, wheelchair user, founder.
- Direct beats padded. Do not sound corporate, sentimental, over-inspirational, vague, or like an equality-and-diversity department.
- Never use pity or inspiration framing. Never use any of these words/phrases: ${banned}.

Before including a post, test it: Is it true? Is it specific? Does it sound like a real person? Does it centre agency rather than pity? Could the founder plausibly say it out loud? If any answer is no, rewrite it.

Return ONLY a JSON array of strings, one per post. No markdown, no commentary.`;
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

function parsePosts(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in model output');
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('Model output is not an array');
  return arr.map((p) => String(p).trim()).filter(Boolean);
}

const SAMPLE_POSTS = [
  'Normalise "what works best for you?" as a first-date question. Curiosity beats assumptions every time. #disabilitycommunity',
  'The bar: an app where your access needs are just part of the plan, not a plot twist. That\'s the whole app. able2love.netlify.app',
  'Poll for the community: best low-energy first date? Wrong answers welcome. 😅 #datinglife',
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;

  const now = new Date();
  const theme = THEMES[isoWeek(now) % THEMES.length];
  console.log(`Theme this week: ${theme}`);

  let posts;
  if (dryRun) {
    posts = SAMPLE_POSTS;
  } else {
    posts = parsePosts(await callGemini(buildPrompt(niche, theme)));
  }

  const approved = [];
  for (const post of posts) {
    const violation = findViolation(post, banned);
    if (violation) {
      console.warn(`Guardrails rejected a post (contains "${violation}"): ${post.slice(0, 60)}...`);
      continue;
    }
    if (BANNED_CHARACTERS.some((ch) => post.includes(ch))) {
      console.warn(`Guardrails rejected a post (contains an em/en dash): ${post.slice(0, 60)}...`);
      continue;
    }
    if (post.length > 275) {
      console.warn(`Rejected over-length post (${post.length} chars)`);
      continue;
    }
    approved.push(post);
  }

  if (!dryRun && approved.length < 3) {
    console.error(`Only ${approved.length} posts survived the guardrails, not writing a batch. Re-run the workflow.`);
    process.exit(1);
  }

  const stamp = now.toISOString().slice(0, 10);
  const file = path.join(OUT_DIR, `batch-${stamp}.md`);
  const lines = [];
  lines.push(`# Able2Love post batch: ${stamp}`);
  lines.push('');
  lines.push(`Theme: **${theme}**`);
  lines.push('');
  lines.push('Written by the content brain, checked against the brand guardrails.');
  lines.push('**Review each post** (edit or delete anything you dislike), then paste the keepers into Buffer\'s X queue, or hand this file to the Claude browser extension to load for you.');
  lines.push('');
  approved.forEach((post, i) => {
    lines.push(`**Post ${i + 1}:**`);
    lines.push('```');
    lines.push(post);
    lines.push('```');
    lines.push('');
  });
  lines.push('---');
  lines.push(`App link for bios and plugs: ${PLAY_LINK}`);
  lines.push('');

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, lines.join('\n'));
  console.log(`Wrote ${approved.length} posts to ${path.relative(ROOT, file)}`);
}

main().catch((error) => {
  console.error('Content brain failed:', error);
  process.exit(1);
});
