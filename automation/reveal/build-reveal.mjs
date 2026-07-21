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

function dedash(x){return String(x).replace(/\s*[\u2014\u2013]\s*/g, ', ');}
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
  const CTA = 'Able2Love \u00b7 first of its kind \u00b7 free on Google Play';
  const revealSub = `See the full picture. ${pair.bSub}`;

  // SAME PICTURE, always (Brogan: "they have to be the same picture or it
  // doesn't work"). Slide 1 is a tight crop of a wheelchair photo, framed so
  // the chair is out of shot (or reads as an ordinary seat); slide 2 is the
  // FULL frame of that exact photo — chair and all. The zoom-out is the proof:
  // same person, same moment, nothing changed but what you can see.
  // SOLO shots only: an image with extra baked bars (background people) would
  // show two bars, which breaks the one-person dating-profile look. Those
  // with-people photos are a different post format, not the swipe card.
  const croppable = manifest.chair.filter((c) => Array.isArray(c.closeCrop) && !c.extraStrips);
  // Fake, identity-safe profile identities (never Brogan's real name).
  const PROFILES = [
    { name: 'Alex, 26', place: 'Manchester \u00b7 2 miles away' },
    { name: 'Jamie, 24', place: 'Manchester \u00b7 just now online' },
    { name: 'Robin, 28', place: 'Salford \u00b7 3 miles away' },
    { name: 'Sam, 25', place: 'Manchester \u00b7 5 miles away' },
    { name: 'Frankie, 27', place: 'Manchester \u00b7 online now' },
  ];
  const profile = PROFILES[((weekNo % PROFILES.length) + PROFILES.length) % PROFILES.length];
  if (!croppable.length) throw new Error('no reveal-library images have a closeCrop');
  const shot = pick(croppable, weekNo);
  const mode = 'zoom';
  const slide1 = { base: shot.file, crop: shot.closeCrop, num: '1 / 2', prompt: dedash(pair.aPrompt),
                   stripY0: shot.stripY0, stripY1: shot.stripY1,
                   barlabel: dedash(pair.barA || 'HOT OR NOT?'), eyeX0: shot.eyeX0, eyeX1: shot.eyeX1, profile: profile.name, place: profile.place };
  const slide2 = { base: shot.file, stripY0: shot.stripY0, stripY1: shot.stripY1, num: '2 / 2',
                   prompt: dedash(pair.bPrompt), sub: dedash(revealSub), kicker: dedash(pair.dare), cta: CTA,
                   barlabel: dedash(pair.barB || 'STILL?'), eyeX0: shot.eyeX0, eyeX1: shot.eyeX1, profile: profile.name, place: profile.place };

  const outPrefix = path.join(weekDir, 'reveal');
  const plan = { slides: [slide1, slide2], out: outPrefix };
  await renderReveal(plan);
  // X has no swipe: build an auto-play MP4 that recreates the reveal.
  let xVideo = null;
  try {
    await makeVideo(`${outPrefix}_1.jpg`, `${outPrefix}_2.jpg`, path.join(weekDir, 'reveal_x.mp4'));
    xVideo = 'reveal_x.mp4';
  } catch (e) { console.warn(`X reveal video skipped: ${e.message.slice(0,120)}`); }

  // X can't carousel the same way; lead with slide 1's hook + a swipe nudge.
  const xText = `${pair.aPrompt} 👀 (swipe on IG to see the full picture) — Able2Love, inclusive dating, first of its kind, free on Google Play. #dating #disability`;
  const igCaption = `${caption}\n\nSee the full picture — Able2Love, the first-of-its-kind inclusive dating app.`;

  return {
    type: 'reveal',
    angle: 'sexy reveal — same photo: crop hides the chair, swipe shows the full picture',
    carousel: ['reveal_1.jpg', 'reveal_2.jpg'],
    xVideo,
    instagram: dedash(igCaption),
    x: dedash(xText).slice(0, 280),
    alt: 'Two-slide dating-app-style carousel: a striking photo framed like a swipe card (eyes covered) with a blunt "smash or pass" prompt, then the reveal that the person is a wheelchair user, for Able2Love, an inclusive dating app.',
    copy: pair,
    mode,
  };
}

function makeVideo(s1, s2, out) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [path.join(HERE, 'make_video.py'), s1, s2, out], { stdio: ['ignore', 'inherit', 'inherit'] });
    py.on('error', reject);
    py.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`make_video.py exited ${code}`))));
  });
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
