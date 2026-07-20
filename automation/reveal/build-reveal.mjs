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
  const sexy = pick(manifest.sexy, weekNo);
  const chair = pick(manifest.chair, weekNo + 1); // offset so the pair varies
  const pair = pick(bank.pairs, weekNo);
  const caption = pick(bank.captions, weekNo);

  const outPrefix = path.join(weekDir, 'reveal');
  const plan = {
    slides: [
      { base: sexy.file, stripY0: sexy.stripY0, stripY1: sexy.stripY1, num: '1 / 2',
        prompt: pair.aPrompt },
      { base: chair.file, stripY0: chair.stripY0, stripY1: chair.stripY1, num: '2 / 2',
        prompt: pair.bPrompt, sub: pair.bSub, kicker: pair.dare,
        cta: 'Able2Love · free on Google Play' },
    ],
    out: outPrefix,
  };

  await renderReveal(plan);

  // X can't carousel the same way; lead with slide 1's hook + a swipe nudge.
  const xText = `${pair.aPrompt} 👀 (swipe on IG for the twist) — Able2Love, inclusive dating, free on Google Play. #dating #disability`;

  return {
    type: 'reveal',
    angle: 'sexy reveal (is this person attractive? → they’re disabled)',
    carousel: ['reveal_1.jpg', 'reveal_2.jpg'],
    instagram: caption,
    x: xText.slice(0, 280),
    alt: 'Two-slide carousel: a striking photo with the eyes covered by a caption strip asking if the person is attractive, then the reveal that they are a wheelchair user, for the inclusive dating app Able2Love.',
    copy: pair,
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
