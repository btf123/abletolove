// Build one "sexy reveal" carousel for a given week.
//
// Concept (Brogan's): a two-slide swipe that baits engagement, then reveals the
// person is disabled — proving attraction was already there. The founder's face
// is de-identified in the committed library (an opaque strip baked over the
// eyes); this module only picks the images + the rotating rhetorical copy and
// calls the Python renderer to lay the copy over the bases.
//
// Cadence: the weekly brain drops ONE of these into the week (~1 in 5 posts),
// so it stays a punch, not a gimmick.

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const LIB = path.join(ROOT, 'marketing/brand-assets/reveal-library');

function pick(arr, seed) { return arr[((seed % arr.length) + arr.length) % arr.length]; }

// Deterministic per-week choice so a re-run is reproducible and consecutive
// weeks rotate through images and copy instead of repeating.
export async function buildReveal(weekNo, weekDir) {
  const manifest = JSON.parse(await readFile(path.join(LIB, 'reveal-library.json'), 'utf8'));
  const bank = JSON.parse(await readFile(path.join(HERE, 'reveal-bank.json'), 'utf8'));
  if (!manifest.sexy?.length || !manifest.chair?.length) {
    throw new Error('reveal library has no sexy/chair images');
  }
  const pair = pick(bank.pairs, weekNo);
  const caption = pick(bank.captions, weekNo);
  const CTA = 'Able2Love — first of its kind · free on Google Play';
  const revealSub = `See the full picture. ${pair.bSub}`;

  // Two reveal shapes, alternated for variety:
  //  - "zoom": ONE wheelchair photo, cropped on slide 1 so the chair reads as an
  //    ordinary seat, then the full frame on slide 2 — the strongest "same
  //    person" proof, and the most literal "see the full picture".
  //  - "pair": a sexy no-chair photo on slide 1, a full wheelchair photo on
  //    slide 2.
  const cropChair = manifest.chair.find((c) => Array.isArray(c.closeCrop));
  const useZoom = cropChair && (weekNo % 2 === 0);

  let slide1, slide2, mode;
  if (useZoom) {
    mode = 'zoom';
    slide1 = { base: cropChair.file, crop: cropChair.closeCrop, num: '1 / 2', prompt: pair.aPrompt };
    slide2 = { base: cropChair.file, stripY0: cropChair.stripY0, stripY1: cropChair.stripY1, num: '2 / 2',
               prompt: pair.bPrompt, sub: revealSub, kicker: pair.dare, cta: CTA };
  } else {
    mode = 'pair';
    const sexy = pick(manifest.sexy, weekNo);
    const chair = pick(manifest.chair, weekNo + 1);
    slide1 = { base: sexy.file, stripY0: sexy.stripY0, stripY1: sexy.stripY1, num: '1 / 2', prompt: pair.aPrompt };
    slide2 = { base: chair.file, stripY0: chair.stripY0, stripY1: chair.stripY1, num: '2 / 2',
               prompt: pair.bPrompt, sub: revealSub, kicker: pair.dare, cta: CTA };
  }

  const outPrefix = path.join(weekDir, 'reveal');
  const plan = { slides: [slide1, slide2], out: outPrefix };
  await renderReveal(plan);

  // X can't carousel the same way; lead with slide 1's hook + a swipe nudge.
  const xText = `${pair.aPrompt} 👀 (swipe on IG to see the full picture) — Able2Love, inclusive dating, first of its kind, free on Google Play. #dating #disability`;
  const igCaption = `${caption}\n\nSee the full picture — Able2Love, the first-of-its-kind inclusive dating app.`;

  return {
    type: 'reveal',
    angle: `sexy reveal — ${mode === 'zoom' ? 'crop hides the chair, then the full picture' : 'sexy shot, then the full picture'}`,
    carousel: ['reveal_1.jpg', 'reveal_2.jpg'],
    instagram: igCaption,
    x: xText.slice(0, 280),
    alt: 'Two-slide dating-app-style carousel: a striking photo framed like a swipe card (eyes covered) with a blunt "smash or pass" prompt, then the reveal that the person is a wheelchair user, for Able2Love, an inclusive dating app.',
    copy: pair,
    mode,
  };
}

function renderReveal(plan) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [path.join(HERE, 'render_reveal.py')], { stdio: ['pipe', 'inherit', 'inherit'] });
    py.on('error', reject);
    py.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`render_reveal.py exited ${code}`))));
    py.stdin.write(JSON.stringify(plan));
    py.stdin.end();
  });
}
