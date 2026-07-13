// Renders Able2Love post text into branded 1080x1080 PNG cards.
// Used by the Instagram generator so every IG post ships with an image.
// Works locally (set PLAYWRIGHT_EXECUTABLE_PATH) and in GitHub Actions
// (where `npx playwright install chromium` provides the browser).

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BRAND_SVG = `<svg class="mk" viewBox="0 0 1024 1024" aria-hidden="true">
  <defs><clipPath id="lh"><rect x="0" y="0" width="512" height="1024"/></clipPath><clipPath id="rh"><rect x="512" y="0" width="512" height="1024"/></clipPath></defs>
  <path clip-path="url(#lh)" fill="#E23349" d="M512,865 C415,770 195,600 195,425 C195,305 285,230 375,230 C428,230 470,262 512,330 C554,262 596,230 649,230 C739,230 829,305 829,425 C829,600 609,770 512,865 Z"/>
  <path clip-path="url(#rh)" fill="#F5798F" d="M512,865 C415,770 195,600 195,425 C195,305 285,230 375,230 C428,230 470,262 512,330 C554,262 596,230 649,230 C739,230 829,305 829,425 C829,600 609,770 512,865 Z"/>
  <path fill="#16101B" d="M350,390 C430,435 594,435 675,390 C645,565 552,680 512,745 C472,680 379,565 350,390 Z"/>
  <circle cx="402" cy="285" r="123" fill="#16101B"/><circle cx="622" cy="285" r="123" fill="#16101B"/>
  <circle cx="402" cy="285" r="105" fill="#E23349"/><circle cx="622" cy="285" r="105" fill="#F5798F"/>
  <path fill="#F9C9D6" d="M512,615 C500,603 456,573 456,542 C456,522 471,511 487,511 C499,511 508,518 512,529 C516,518 525,511 537,511 C553,511 568,522 568,542 C568,573 524,603 512,615 Z"/>
</svg>`;

function fontFor(text) {
  const n = text.length;
  if (n <= 42) return 82;
  if (n <= 70) return 66;
  if (n <= 105) return 54;
  if (n <= 150) return 45;
  return 38;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cardHtml(headline) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}html{background:#16101B}
    body{width:1080px;height:1080px;overflow:hidden;position:relative;background:#16101B;
      font-family:"Liberation Sans","DejaVu Sans",sans-serif;color:#fff;
      display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box}
    .brandrow{position:absolute;top:64px;left:90px;display:flex;align-items:center;gap:16px}
    .mk{width:58px;height:58px}
    .brandname{font-size:30px;font-weight:700;letter-spacing:-.5px}
    .headline{font-size:${fontFor(headline)}px;font-weight:700;line-height:1.22;letter-spacing:-.01em;max-width:17ch}
    .accentbar{width:120px;height:8px;border-radius:4px;background:linear-gradient(90deg,#E23349,#F5798F);margin-top:44px}
    .foot{position:absolute;bottom:64px;left:90px;font-size:26px;font-weight:600;color:#F5798F}
  </style></head><body>
    <div class="brandrow">${BRAND_SVG}<div class="brandname">Able2Love</div></div>
    <div class="headline">${escapeHtml(headline)}</div>
    <div class="accentbar"></div>
    <div class="foot">Able2Love. Free on Google Play.</div>
  </body></html>`;
}

/**
 * Render an array of {headline} items to PNG cards in outDir.
 * Returns the list of written file paths.
 */
export async function renderCards(items, outDir) {
  await mkdir(outDir, { recursive: true });
  const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const browser = await chromium.launch(exe
    ? { executablePath: exe, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  const written = [];
  try {
    for (let i = 0; i < items.length; i++) {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
      await page.setContent(cardHtml(items[i].headline), { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const file = path.join(outDir, `card-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      await page.close();
      written.push(file);
    }
  } finally {
    await browser.close();
  }
  return written;
}

// Standalone test: node render-cards.mjs (renders sample cards)
if (import.meta.url === `file://${process.argv[1]}`) {
  const samples = [
    { headline: 'Dating apps weren’t built for us. So we built one.' },
    { headline: 'Non-disabled people who date disabled people are not heroes. They just fancied someone.' },
    { headline: 'Your access needs are part of the plan, not a plot twist.' },
  ];
  const out = path.resolve(process.cwd(), 'content-queue/instagram/_sample');
  const files = await renderCards(samples, out);
  console.log('Rendered sample cards:\n' + files.join('\n'));
}
