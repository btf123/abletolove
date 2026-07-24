// Renders the static brand-asset source HTML (marketing/brand-assets/src/*.html)
// to their committed PNGs at the exact sizes they're used at. These were
// previously rendered ad-hoc; this makes them regenerable and keeps the new
// wordmark consistent across every surface.
//
// Local:  cd automation && npm install playwright-core playwright && npx playwright install chromium && node build-brand-assets.mjs
// CI:     .github/workflows/build-brand-assets.yml (manual dispatch)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'marketing/brand-assets/src');
const OUT = path.join(ROOT, 'marketing/brand-assets');

// src file -> [output PNG, width, height]
const ASSETS = [
  ['feature-disclosure.html', 'feature-disclosure-1080x1350.png', 1080, 1350],
  ['feature-nearby.html', 'feature-nearby-1080x1350.png', 1080, 1350],
  ['feature-plandate.html', 'feature-plandate-1080x1350.png', 1080, 1350],
  ['feature-seemefirst.html', 'feature-seemefirst-1080x1350.png', 1080, 1350],
  ['green-flags.html', 'green-flags-1080x1080.png', 1080, 1080],
  ['ig-intro-post.html', 'ig-intro-post-1080x1080.png', 1080, 1080],
  ['stat-58.html', 'stat-58-disclosure-1080x1080.png', 1080, 1080],
  ['x-banner.html', 'x-banner-1500x500.png', 1500, 500],
  ['avatar.html', 'profile-picture-1000x1000.png', 1000, 1000],
];

const only = process.argv[2]; // optional: render just one src file
const exe = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
try {
  for (const [src, outName, w, h] of ASSETS) {
    if (only && src !== only) continue;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const url = 'file:///' + path.join(SRC, src).replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, outName) });
    await page.close();
    console.log('rendered', outName);
  }
} finally {
  await browser.close();
}
