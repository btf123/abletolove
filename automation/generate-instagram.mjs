#!/usr/bin/env node
/**
 * Able2Love Instagram brain.
 *
 * Instagram requires an image on every post, so this writes a short set of
 * posts AND renders a branded card image for each one. Output: a batch file
 * plus PNGs in content-queue/instagram/, ready to load into Buffer.
 *
 * Usage:
 *   GEMINI_API_KEY=... node automation/generate-instagram.mjs
 *   node automation/generate-instagram.mjs --dry-run   (no API call, samples)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCards } from './lib/render-cards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NICHE_FILE = path.join(ROOT, 'social-media-bot/config/abletolove.niche.json');
const OUT_DIR = path.join(ROOT, 'content-queue/instagram');

const PLAY_LINK = 'https://play.google.com/store/apps/details?id=com.abletolove.app';
const POSTS_PER_BATCH = 3;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const THEMES = [
  'the relief of not having to explain yourself on a dating app',
  'green flags and respectful curiosity',
  'accessibility as a feature mainstream apps forgot',
  'funny, relatable moments from dating with a disability',
  'community and belonging',
  'chronic illness and dating honestly',
  'neurodivergent dating and communication',
  'myths about disabled people and relationships, gently debunked',
];

const DEFAULT_BANNED = [
  'suffers from', 'afflicted', 'confined to a wheelchair', 'wheelchair-bound',
  'special needs', 'differently abled', 'handicapable', 'overcame',
  'despite her disability', 'despite his disability', 'despite their disability',
  'inspiring us all', 'brave', 'passionate', 'empowering', 'transformative',
  'inspirational', 'journey to love',
];
const BANNED_CHARACTERS = ['—', '–'];

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - start) / 86400000 + 1) / 7);
}

function findViolation(text, banned) {
  const hay = text.toLowerCase();
  for (const p of banned) if (hay.includes(p.toLowerCase())) return p;
  return null;
}

function buildPrompt(niche, theme) {
  const tone = niche.content_tone || 'direct, human and dryly funny';
  const banned = (niche.campaign_guardrails?.banned_language || DEFAULT_BANNED).join('; ');
  return `You are the communications assistant for Able2Love, a dating app connecting disabled and non-disabled people who are open to dating one another. Visible disability is normalised, never hidden or fetishised. Write as the founder: a Manchester comedy writer and full-time wheelchair user. Performer first.

Tone: ${tone}
This week's theme: ${theme}

Write ${POSTS_PER_BATCH} Instagram posts. Each has:
- "headline": a short, punchy line for the image card (max 90 characters, no hashtags, no link). This is the hook people see.
- "caption": the Instagram caption (2 to 4 sentences, warm and direct, ending by pointing people to the app, e.g. "Free on Google Play, link in bio").
- "hashtags": 4 to 6 lowercase hashtags as an array (no # symbol).

Rules:
- UK English only. NEVER use an em dash or en dash; use commas, colons or full stops.
- Funny is welcome (dry, observational). Never make disabled bodies, care needs or trauma the punchline.
- Treat disabled people as adults with attraction, standards and humour. Never praise non-disabled people merely for dating a disabled person.
- Never invent stats, features, user numbers or momentum.
- Never use these words/phrases: ${banned}.

Return ONLY a JSON array of ${POSTS_PER_BATCH} objects with keys headline, caption, hashtags. No markdown, no commentary.`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error('GEMINI_API_KEY is not set (see marketing/07-free-bot.md).'); process.exit(1); }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } }),
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
  const start = cleaned.indexOf('['); const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in model output');
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('Model output is not an array');
  return arr;
}

const SAMPLE = [
  { headline: 'The disclosure text no one here has to draft.', caption: 'On mainstream apps it is a whole nervous speech. On Able2Love it is just part of your profile. Share what you want, when you want. Free on Google Play, link in bio.', hashtags: ['disabilitydating', 'disabilitycommunity', 'dating', 'able2love'] },
  { headline: 'Your access needs are part of the plan, not a plot twist.', caption: 'Built with the community, not for it. Accessibility is the foundation here, not a settings toggle you have to go hunting for. Free on Google Play, link in bio.', hashtags: ['accessibility', 'inclusivedating', 'disabilitypride', 'able2love'] },
  { headline: 'Disabled people have standards too. Wild, we know.', caption: 'This is not grateful for anyone. It is preferences, a sense of humour and a type, same as everyone. Come find your people. Free on Google Play, link in bio.', hashtags: ['disabilitydating', 'dating', 'disabilitycommunity', 'able2love'] },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const niche = JSON.parse(await readFile(NICHE_FILE, 'utf8'));
  const banned = niche.campaign_guardrails?.banned_language || DEFAULT_BANNED;
  const now = new Date();
  const theme = THEMES[isoWeek(now) % THEMES.length];
  console.log(`Instagram theme this week: ${theme}`);

  let posts = dryRun ? SAMPLE : parsePosts(await callGemini(buildPrompt(niche, theme)));

  const approved = [];
  for (const p of posts) {
    const headline = String(p.headline || '').trim();
    const caption = String(p.caption || '').trim();
    const hashtags = Array.isArray(p.hashtags) ? p.hashtags.map(String) : [];
    if (!headline || !caption) continue;
    const blob = `${headline} ${caption} ${hashtags.join(' ')}`;
    const violation = findViolation(blob, banned);
    if (violation) { console.warn(`Rejected (banned phrase "${violation}"): ${headline.slice(0, 50)}`); continue; }
    if (BANNED_CHARACTERS.some((ch) => blob.includes(ch))) { console.warn(`Rejected (em/en dash): ${headline.slice(0, 50)}`); continue; }
    if (headline.length > 100) { console.warn(`Rejected (headline too long): ${headline.slice(0, 50)}`); continue; }
    approved.push({ headline, caption, hashtags });
  }

  if (!dryRun && approved.length < 2) {
    console.error(`Only ${approved.length} IG posts survived the guardrails, not writing a batch. Re-run.`);
    process.exit(1);
  }

  const stamp = now.toISOString().slice(0, 10);
  const batchDir = path.join(OUT_DIR, stamp);
  const cardFiles = await renderCards(approved, batchDir);

  const lines = [`# Able2Love Instagram batch: ${stamp}`, '', `Theme: **${theme}**`, ''];
  lines.push('Each post has a ready-made card image (in this folder) and a caption. Review, then load caption + image into Buffer\'s Instagram queue (or hand this folder to the Claude browser extension).');
  lines.push('');
  approved.forEach((p, i) => {
    lines.push(`## Post ${i + 1}`);
    lines.push(`**Image:** \`${path.basename(cardFiles[i])}\``);
    lines.push('**Caption:**');
    lines.push('```');
    lines.push(`${p.caption}\n\n${p.hashtags.map((h) => '#' + h).join(' ')}`);
    lines.push('```');
    lines.push(`**Alt text:** Text on a dark Able2Love card that reads: "${p.headline}"`);
    lines.push('');
  });
  lines.push('---');
  lines.push(`App link for the bio: ${PLAY_LINK}`);
  await mkdir(batchDir, { recursive: true });
  await writeFile(path.join(batchDir, 'captions.md'), lines.join('\n'));
  console.log(`Wrote ${approved.length} Instagram posts with cards to ${path.relative(ROOT, batchDir)}`);
}

main().catch((error) => { console.error('Instagram brain failed:', error); process.exit(1); });
