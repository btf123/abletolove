// Renders Able2Love post text into branded 1080x1080 PNG cards.
//
// Cards are now TYPED, not just a headline on a dark square. Each item has a
// `type` and the fields that type needs. Types:
//   photo      full-bleed licence-clear photo (Pexels) + caption overlay
//   photoApp   photo + a real app screenshot layered as a floating phone
//   split      two phones, one conversation, both sides (a disabled + a
//              non-disabled person connecting)
//   statTake   a real, sourced statistic then Brogan's take on it
//   statement  eyebrow + big belief line + support (the "why we built it" card)
//   flags      red flag vs green flags
//   feature    a real app screenshot in a phone with a feature explainer
//   headline   legacy: a single line (kept as a safe fallback)
//
// Photo types fetch a photo at render time (GitHub Actions has internet). With no
// PEXELS_API_KEY, or on any failure, a photo card degrades to a photo-free
// gradient version so the pipeline never breaks.
//
// Works locally (set PLAYWRIGHT_EXECUTABLE_PATH) and in GitHub Actions.

import { chromium } from 'playwright-core';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPhoto } from './photos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'marketing/brand-assets/src');
// Optional background imagery for the manifesto/"why I built it" (statement)
// card. POLICY: Brogan is deliberately NOT the face of the app — his
// identifiable face must never appear on a rendered card. So this directory is
// kept EMPTY of any photo in which he is recognisable. Only genuinely
// non-identifying imagery belongs here (e.g. stage lights, a silhouette, a
// crowd from behind, hands). With the directory empty, statement/founder cards
// fall back to the warm gradient card, which is the safe default.
const FOUNDER_DIR = path.join(ROOT, 'marketing/brand-assets/founder-photos');
// The reveal library's bases have the identity strip BAKED over the eyes, so
// they are safe by construction — statement cards may use them as backdrops.
const REVEAL_LIB = path.join(ROOT, 'marketing/brand-assets/reveal-library');
let founderPhotoDir = FOUNDER_DIR;
async function listFounderPhotos() {
  try {
    const own = (await readdir(FOUNDER_DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
    if (own.length) { founderPhotoDir = FOUNDER_DIR; return own; }
  } catch { /* fall through */ }
  try {
    founderPhotoDir = REVEAL_LIB;
    return (await readdir(REVEAL_LIB)).filter((f) => /\.jpe?g$/i.test(f)).sort();
  } catch { return []; }
}

// Feature key -> real app screenshot file.
const FEATURE_SHOTS = {
  disclosure: 'disclosure-screen.png',
  nearby: 'nearby-screen.png',
  plandate: 'plan-date-screen.png',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HEART = (bg = '#16101B') => `<svg class="mk" viewBox="0 0 1024 1024" aria-hidden="true">
  <defs><clipPath id="lh"><rect x="0" y="0" width="512" height="1024"/></clipPath><clipPath id="rh"><rect x="512" y="0" width="512" height="1024"/></clipPath></defs>
  <path clip-path="url(#lh)" fill="#E23349" d="M512,865 C415,770 195,600 195,425 C195,305 285,230 375,230 C428,230 470,262 512,330 C554,262 596,230 649,230 C739,230 829,305 829,425 C829,600 609,770 512,865 Z"/>
  <path clip-path="url(#rh)" fill="#F5798F" d="M512,865 C415,770 195,600 195,425 C195,305 285,230 375,230 C428,230 470,262 512,330 C554,262 596,230 649,230 C739,230 829,305 829,425 C829,600 609,770 512,865 Z"/>
  <path fill="${bg}" d="M350,390 C430,435 594,435 675,390 C645,565 552,680 512,745 C472,680 379,565 350,390 Z"/>
  <circle cx="402" cy="285" r="123" fill="${bg}"/><circle cx="622" cy="285" r="123" fill="${bg}"/>
  <circle cx="402" cy="285" r="105" fill="#E23349"/><circle cx="622" cy="285" r="105" fill="#F5798F"/>
  <path fill="#F9C9D6" d="M512,615 C500,603 456,573 456,542 C456,522 471,511 487,511 C499,511 508,518 512,529 C516,518 525,511 537,511 C553,511 568,522 568,542 C568,573 524,603 512,615 Z"/>
</svg>`;

const WARM_BG = `background:
  radial-gradient(circle at 84% 12%, #B23AD8 0%, rgba(178,58,216,0) 46%),
  radial-gradient(circle at 8% 26%, #E23349 0%, rgba(226,51,73,0) 42%),
  radial-gradient(circle at 78% 96%, #FF8FA6 0%, rgba(255,143,166,0) 50%),
  linear-gradient(150deg, #2E1224 0%, #160810 100%);`;

const PAGE = `html,body{margin:0;padding:0}
  body{width:1080px;height:1080px;overflow:hidden;position:relative;color:#fff;box-sizing:border-box;
    font-family:"Liberation Sans","DejaVu Sans",sans-serif}`;
const BRANDROW = (bg = '#16101B', top = 58, left = 80) =>
  `<div class="brandrow" style="top:${top}px;left:${left}px">${HEART(bg)}<div class="brandname">Able2Love</div></div>`;
const BRANDCSS = `.brandrow{position:absolute;display:flex;align-items:center;gap:15px;z-index:6}
  .mk{width:56px;height:56px}.brandname{font-size:30px;font-weight:700;letter-spacing:-.5px}`;

function fontForStatement(text) {
  const n = String(text).length;
  if (n <= 46) return 92; if (n <= 74) return 78; if (n <= 110) return 62; if (n <= 150) return 50; return 42;
}

// --- STATEMENT / HERO ---
function statementCard(it) {
  const st = it.statement || it.headline || '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE} html{${WARM_BG}}${BRANDCSS}
    .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 80px}
    ${it.kicker ? '' : '.eyebrow{font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#FF9DB0;margin-bottom:22px}'}
    .kicker{display:inline-block;align-self:flex-start;font-size:23px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#E23349,#B23AD8);padding:12px 22px;border-radius:100px;margin-bottom:32px;box-shadow:0 12px 30px -8px rgba(226,51,73,.6)}
    .statement{font-size:${fontForStatement(st)}px;font-weight:800;line-height:1.06;letter-spacing:-2px;max-width:15ch;text-shadow:0 6px 40px rgba(0,0,0,.3)}
    .statement b{background:linear-gradient(120deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .support{font-size:33px;font-weight:600;line-height:1.4;color:#F3E4EA;margin-top:34px;max-width:22ch}
    .foot{position:absolute;bottom:58px;left:80px;font-size:27px;font-weight:700;color:#fff}
    .foot small{color:#F5C6D2;font-weight:500;margin-left:6px}
  </style></head><body>${BRANDROW()}
    <div class="wrap">
      ${it.kicker ? `<span class="kicker">${esc(it.kicker)}</span>` : (it.eyebrow ? `<div class="eyebrow">${esc(it.eyebrow)}</div>` : '')}
      <div class="statement">${it.allowHtml ? st : esc(st)}</div>
      ${it.support ? `<div class="support">${esc(it.support)}</div>` : ''}
    </div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

// --- FOUNDER (statement over a real photo of Brogan) ---
function founderCard(it, photoB64, mime) {
  const st = it.statement || it.headline || '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE}
    .bg{position:absolute;inset:0}.bg img{width:100%;height:100%;object-fit:cover;object-position:50% 24%}
    .wash{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,8,15,.4) 0%,rgba(20,8,15,0) 24%,rgba(18,7,12,.22) 52%,rgba(18,7,12,.85) 80%,#120709 100%),radial-gradient(circle at 80% 88%,rgba(226,51,73,.28),rgba(226,51,73,0) 60%)}
    ${BRANDCSS}.brandrow{top:44px;left:52px}.mk{width:52px;height:52px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.6))}.brandname{text-shadow:0 2px 12px rgba(0,0,0,.7)}
    .eyebrow{position:absolute;left:56px;bottom:${it.support ? 348 : 300}px;font-size:24px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#FF9DB0;text-shadow:0 2px 12px rgba(0,0,0,.8)}
    .statement{position:absolute;left:56px;right:70px;bottom:${it.support ? 232 : 150}px;font-size:${Math.min(66, fontForStatement(st))}px;font-weight:800;line-height:1.06;letter-spacing:-1.4px;text-shadow:0 4px 30px rgba(0,0,0,.72)}
    .statement b{background:linear-gradient(120deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .support{position:absolute;left:56px;right:90px;bottom:150px;font-size:29px;font-weight:600;line-height:1.35;color:#F3E4EA;text-shadow:0 2px 14px rgba(0,0,0,.7)}
    .foot{position:absolute;left:56px;bottom:60px;font-size:25px;font-weight:700}.foot small{color:#F5C6D2;font-weight:500;margin-left:6px}
  </style></head><body>
    <div class="bg"><img src="data:${mime};base64,${photoB64}" alt=""></div>
    <div class="wash"></div>${BRANDROW()}
    ${it.eyebrow ? `<div class="eyebrow">${esc(it.eyebrow)}</div>` : ''}
    <div class="statement">${it.allowHtml ? st : esc(st)}</div>
    ${it.support ? `<div class="support">${esc(it.support)}</div>` : ''}
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

// --- STAT + TAKE ---
function statTakeCard(it) {
  // The take is clamped upstream, but scale the font as a belt-and-braces guard
  // so a longer take can never shove the 58% off the top again.
  const tn = String(it.take || '').length;
  const takeFs = tn <= 110 ? 30 : tn <= 160 ? 26 : 23;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE} html{${WARM_BG}}${BRANDCSS}
    .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 80px}
    .eyebrow{font-size:24px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#FFC64D;margin-bottom:6px}
    .stat{font-size:220px;font-weight:800;line-height:.86;letter-spacing:-6px;background:linear-gradient(135deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0 0 6px -4px}
    .claim{font-size:38px;font-weight:600;line-height:1.24;max-width:22ch;margin:0 0 24px;color:#F3E4EA}
    .take{background:rgba(0,0,0,.3);border-left:6px solid #E23349;border-radius:14px;padding:22px 28px;max-width:27ch}
    .take .lbl{font-size:21px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#FF8FA6;margin-bottom:10px}
    .take .txt{font-size:${takeFs}px;font-weight:600;line-height:1.32}
    .source{position:absolute;bottom:54px;left:80px;font-size:20px;color:#C9A9B6;font-weight:500}
  </style></head><body>${BRANDROW()}
    <div class="wrap">
      <div class="eyebrow">${esc(it.eyebrow)}</div>
      <div class="stat">${esc(it.stat)}</div>
      <div class="claim">${esc(it.claim)}</div>
      <div class="take"><div class="lbl">My take</div><div class="txt">${esc(it.take)}</div></div>
    </div>
    <div class="source">${esc(it.source)}</div>
  </body></html>`;
}

// --- SPLIT SCREEN ---
function avatarHtml(p) {
  const grad = p.grad || ['#B23AD8', '#E23349'];
  return `<div class="av" style="background:linear-gradient(135deg,${grad[0]},${grad[1]})">${esc(p.initial || (p.name || '?')[0])}</div>`;
}
function phoneHtml(p, roles) {
  const rows = (p.messages || []).map((m, i) => `<div class="msg ${roles[i % roles.length]}">${esc(m)}</div>`).join('');
  const meta = p.chip
    ? `<div class="chip">${esc(p.chip)}</div>`
    : `<div class="pstat">Active now</div>`;
  return `<div class="phone"><div class="screen">
    <div class="phead">${avatarHtml(p)}<div class="pmeta"><div class="pn">${esc(p.name)}</div>${meta}</div></div>
    <div class="chat">${rows}</div>
  </div></div>`;
}
// Scale the chat text so even long, funny banter always fits both phones.
function fontForChat(msgs) {
  const n = msgs.join(' ').length;
  if (n <= 150) return { fs: 23, gap: 16, pad: '15px 19px' };
  if (n <= 230) return { fs: 21, gap: 14, pad: '13px 17px' };
  if (n <= 320) return { fs: 19, gap: 12, pad: '12px 16px' };
  if (n <= 420) return { fs: 17, gap: 11, pad: '11px 15px' };
  return { fs: 15, gap: 9, pad: '10px 14px' };
}
function splitCard(it) {
  const A = it.personA, B = it.personB;
  const msgs = it.messages || [];
  // Same conversation, both sides: A's messages are outgoing on A's phone,
  // incoming on B's phone. Turns alternate starting with A.
  A.messages = msgs; B.messages = msgs;
  const aRoles = ['out', 'in']; // msg0 (A) out on A's phone, msg1 (B) in, ...
  const bRoles = ['in', 'out'];
  const c = fontForChat(msgs);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE} html{${WARM_BG}}${BRANDCSS}
    .brandrow{top:52px;left:70px}.mk{width:48px;height:48px}.brandname{font-size:26px}
    .hero{position:absolute;top:118px;left:70px;right:70px;text-align:center;z-index:8}
    .hero h1{margin:0;font-size:50px;font-weight:800;letter-spacing:-1px;line-height:1.1}
    .hero h1 b{background:linear-gradient(120deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .stage{position:absolute;top:250px;left:0;right:0;display:flex;justify-content:center;gap:34px}
    .phone{width:404px;height:664px;background:#0b0710;border-radius:44px;padding:12px;box-shadow:0 44px 90px -22px rgba(0,0,0,.75),inset 0 0 0 2px rgba(255,255,255,.07)}
    .phone:first-child{transform:rotate(-4deg) translateY(14px)}.phone:last-child{transform:rotate(4deg) translateY(14px)}
    .screen{width:100%;height:100%;background:linear-gradient(180deg,#1c1119,#120a10);border-radius:34px;overflow:hidden;display:flex;flex-direction:column}
    .phead{display:flex;align-items:center;gap:16px;padding:26px 24px 18px;border-bottom:1px solid rgba(255,255,255,.06)}
    .av{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;flex:none}
    .pn{font-size:30px;font-weight:700}.pstat{font-size:19px;color:#7FE0A0;font-weight:600;margin-top:3px}
    .chip{display:inline-block;margin-top:6px;font-size:18px;font-weight:700;border:1.5px solid #C99BF055;color:#C99BF0;border-radius:100px;padding:4px 14px}
    .chat{flex:1;display:flex;flex-direction:column;gap:${c.gap}px;padding:24px 22px;justify-content:flex-end;overflow:hidden}
    .msg{max-width:82%;font-size:${c.fs}px;font-weight:500;line-height:1.3;padding:${c.pad};border-radius:22px}
    .msg.in{align-self:flex-start;background:#2a2129;color:#F2E9ED;border-bottom-left-radius:7px}
    .msg.out{align-self:flex-end;background:linear-gradient(135deg,#E23349,#F5798F);color:#fff;border-bottom-right-radius:7px}
    .foot{position:absolute;bottom:50px;left:0;right:0;text-align:center;font-size:26px;font-weight:700;z-index:8}
    .foot small{display:block;color:#F5C6D2;font-weight:500;font-size:21px;margin-top:4px}
  </style></head><body>${BRANDROW()}
    <div class="hero"><h1>${it.title ? (it.allowHtml ? it.title : esc(it.title)) : 'One conversation. <b>Both sides. No explaining.</b>'}</h1></div>
    <div class="stage">${phoneHtml(A, aRoles)}${phoneHtml(B, bRoles)}</div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

// --- FLAGS ---
function flagsCard(it) {
  const check = `<svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="20" stroke="#5FD98C" stroke-width="3"/><path d="M13 22.5l6 6 12-13" stroke="#5FD98C" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const greens = (it.greens || []).slice(0, 3).map((g) => `<div class="flag">${check}<span>${esc(g)}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE} html{${WARM_BG}} body{padding:0 84px}${BRANDCSS}
    .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 84px}
    .redcard{background:rgba(20,10,16,.55);border:1px solid #3A2731;border-radius:22px;padding:30px 34px;margin-bottom:40px;backdrop-filter:blur(3px)}
    .rflabel{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#FF8A8A;margin-bottom:16px}
    .rflabel svg{width:26px;height:30px}
    .bio{font-size:38px;font-weight:600;line-height:1.3;color:#F1E7EA}
    .aside{font-size:26px;color:#D9B9C6;margin-top:12px;font-style:italic}
    .gflabel{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#7FE0A0;margin-bottom:24px}
    .gflabel .dot{width:22px;height:22px;border-radius:50%;background:#7FE0A0;display:inline-block}
    .flag{display:flex;align-items:flex-start;gap:22px;margin-bottom:20px}
    .flag svg{width:44px;height:44px;flex:none;margin-top:2px}.flag span{font-size:37px;font-weight:600;line-height:1.25}
    .foot{position:absolute;bottom:58px;left:84px;font-size:27px;font-weight:700;color:#fff}
    .foot small{color:#F5C6D2;font-weight:500;margin-left:6px}
  </style></head><body>${BRANDROW()}
    <div class="wrap">
      <div class="redcard">
        <div class="rflabel"><svg viewBox="0 0 24 28" fill="none"><path d="M4 2v24" stroke="#FF8A8A" stroke-width="2.5" stroke-linecap="round"/><path d="M4 3h15l-3 5 3 5H4z" fill="#FF8A8A"/></svg>Red flag</div>
        <div class="bio">${esc(it.redBio)}</div>
        ${it.redAside ? `<div class="aside">${esc(it.redAside)}</div>` : ''}
      </div>
      <div class="gflabel"><span class="dot"></span>Green flags only</div>
      ${greens}
    </div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

// --- FEATURE (real app screenshot in a phone) ---
function featureCard(it, shotB64) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE}
    body{background:radial-gradient(circle at 82% 14%,#9C27B0 0%,rgba(156,39,176,0) 44%),radial-gradient(circle at 10% 34%,#E23349 0%,rgba(226,51,73,0) 40%),radial-gradient(circle at 80% 94%,#F5798F 0%,rgba(245,121,143,0) 46%),linear-gradient(150deg,#2A1020 0%,#16080F 100%)}
    ${BRANDCSS}.brandrow{top:52px;left:60px}.mk{width:50px;height:50px}.brandname{font-size:27px}
    .head{position:absolute;top:150px;left:60px;right:60px;z-index:5}
    .head .k{font-size:22px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#FF9DB0;margin-bottom:14px}
    .head h1{margin:0;font-size:56px;line-height:1.06;font-weight:800;letter-spacing:-1.4px;max-width:17ch}
    .phone{position:absolute;bottom:-46px;left:56px;width:400px;height:720px;background:#0c0710;border-radius:46px;padding:11px;box-shadow:0 40px 90px -20px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.06);z-index:3}
    .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block}
    .callout{position:absolute;right:52px;top:470px;width:426px;z-index:6}
    .bubble{background:#fff;color:#1A0B16;border-radius:24px;padding:26px 28px;box-shadow:0 26px 60px -18px rgba(0,0,0,.55);position:relative}
    .bubble .k{font-size:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8E24AA;margin-bottom:9px}
    .bubble .h{font-size:29px;font-weight:800;line-height:1.18;letter-spacing:-.4px}
    .bubble .s{font-size:19px;color:#5b4a52;margin-top:10px;line-height:1.36}
    .bubble .arrow{position:absolute;left:-28px;top:52px;width:0;height:0;border-top:18px solid transparent;border-bottom:18px solid transparent;border-right:32px solid #fff}
    .foot{position:absolute;bottom:50px;right:60px;font-size:25px;font-weight:700;text-align:right;z-index:7}
    .foot small{display:block;font-weight:500;color:#F5C6D2;font-size:20px;margin-top:4px}
  </style></head><body>${BRANDROW('#16080F', 52, 60)}
    <div class="head"><div class="k">${esc(it.eyebrow)}</div><h1>${esc(it.headline)}</h1></div>
    <div class="phone"><img src="data:image/png;base64,${shotB64}" alt=""></div>
    <div class="callout"><div class="bubble"><div class="arrow"></div>
      <div class="k">${esc(it.bubble?.label || 'Tap to reveal')}</div>
      <div class="h">${esc(it.bubble?.h || '')}</div><div class="s">${esc(it.bubble?.s || '')}</div>
    </div></div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

// --- PHOTO (full bleed) ---
function photoCard(it, photo) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE}
    .bg{position:absolute;inset:0}.bg img{width:100%;height:100%;object-fit:cover;object-position:50% 30%}
    .wash{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,8,15,.34) 0%,rgba(20,8,15,0) 26%,rgba(20,8,15,.18) 54%,rgba(18,7,12,.82) 82%,#120709 100%),radial-gradient(circle at 78% 88%,rgba(226,51,73,.3),rgba(226,51,73,0) 60%)}
    ${BRANDCSS}.brandrow{top:44px;left:52px}.mk{width:52px;height:52px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))}.brandname{text-shadow:0 2px 12px rgba(0,0,0,.6)}
    .eyebrow{position:absolute;left:56px;bottom:322px;font-size:24px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#FF9DB0;text-shadow:0 2px 12px rgba(0,0,0,.7)}
    .caption{position:absolute;left:56px;right:70px;bottom:150px;font-size:64px;font-weight:800;line-height:1.08;letter-spacing:-1.4px;text-shadow:0 4px 30px rgba(0,0,0,.65)}
    .caption b{background:linear-gradient(120deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .foot{position:absolute;left:56px;bottom:60px;font-size:25px;font-weight:700}.foot small{color:#F5C6D2;font-weight:500;margin-left:6px}
    .tag{position:absolute;right:52px;bottom:60px;font-size:22px;font-weight:600;color:#F5C6D2}
  </style></head><body>
    <div class="bg"><img src="data:${photo.mime};base64,${photo.b64}" alt=""></div>
    <div class="wash"></div>${BRANDROW()}
    ${it.eyebrow ? `<div class="eyebrow">${esc(it.eyebrow)}</div>` : ''}
    <div class="caption">${it.allowHtml ? it.caption : esc(it.caption)}</div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
    ${it.tag ? `<div class="tag">${esc(it.tag)}</div>` : ''}
  </body></html>`;
}

// --- PHOTO + APP PHONE ---
function photoAppCard(it, photo, shotB64) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE}
    .bg{position:absolute;inset:0}.bg img{width:100%;height:100%;object-fit:cover;object-position:28% 30%}
    .wash{position:absolute;inset:0;background:linear-gradient(115deg,rgba(18,7,12,.12) 0%,rgba(18,7,12,.55) 46%,rgba(18,7,12,.9) 74%,#120709 100%),radial-gradient(circle at 84% 20%,rgba(178,58,216,.4),rgba(178,58,216,0) 55%)}
    ${BRANDCSS}.brandrow{top:44px;left:52px}.mk{width:52px;height:52px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))}
    .phone{position:absolute;right:52px;top:170px;width:340px;height:690px;background:#0b0710;border-radius:40px;padding:10px;box-shadow:0 40px 90px -18px rgba(0,0,0,.8),inset 0 0 0 2px rgba(255,255,255,.08);transform:rotate(5deg);z-index:4}
    .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:31px;display:block}
    .eyebrow{position:absolute;left:56px;bottom:300px;font-size:23px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#FF9DB0}
    .caption{position:absolute;left:56px;right:430px;bottom:150px;font-size:54px;font-weight:800;line-height:1.1;letter-spacing:-1.2px;text-shadow:0 4px 24px rgba(0,0,0,.6)}
    .caption b{background:linear-gradient(120deg,#FFC64D,#FF8FA6);-webkit-background-clip:text;background-clip:text;color:transparent}
    .foot{position:absolute;left:56px;bottom:60px;font-size:25px;font-weight:700}.foot small{color:#F5C6D2;font-weight:500;margin-left:6px}
  </style></head><body>
    <div class="bg"><img src="data:${photo.mime};base64,${photo.b64}" alt=""></div>
    <div class="wash"></div>${BRANDROW()}
    <div class="phone"><img src="data:image/png;base64,${shotB64}" alt=""></div>
    ${it.eyebrow ? `<div class="eyebrow">${esc(it.eyebrow)}</div>` : ''}
    <div class="caption">${it.allowHtml ? it.caption : esc(it.caption)}</div>
    <div class="foot">Able2Love<small>Free on Google Play</small></div>
  </body></html>`;
}

async function shot(feature) {
  const file = FEATURE_SHOTS[feature] || FEATURE_SHOTS.disclosure;
  try { return (await readFile(path.join(SRC, file))).toString('base64'); }
  catch { return null; }
}

// Resolve an item to final HTML, fetching photos/screenshots as needed.
async function itemToHtml(it, index) {
  const type = it.type || 'headline';
  if (type === 'photo' || type === 'photoApp') {
    const photo = await fetchPhoto(it.imageQuery || 'interabled couple smiling', { pick: (it.photoPick || 0) + index });
    if (!photo) {
      // Graceful fallback: no photo -> a warm statement card carrying the caption.
      return statementCard({ eyebrow: it.eyebrow, statement: it.caption, allowHtml: it.allowHtml });
    }
    if (type === 'photoApp') return photoAppCard(it, photo, await shot(it.feature));
    return photoCard(it, photo);
  }
  if (type === 'feature') return featureCard(it, await shot(it.feature));
  if (type === 'statTake') return statTakeCard(it);
  if (type === 'split') return splitCard(it);
  if (type === 'flags') return flagsCard(it);
  if (type === 'statement' || type === 'founder') {
    // Put Brogan's real photo behind the manifesto card when we have one.
    const founders = await listFounderPhotos();
    if (founders.length) {
      const file = founders[(it.photoPick || 0 + index) % founders.length];
      try {
        const buf = await readFile(path.join(founderPhotoDir, file));
        const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
        return founderCard(it, buf.toString('base64'), mime);
      } catch { /* fall through to gradient */ }
    }
    return statementCard(it);
  }
  return statementCard({ statement: it.headline || it.statement || '', eyebrow: it.eyebrow });
}

/**
 * Render an array of typed items to PNG cards in outDir.
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
      const html = await itemToHtml(items[i], i);
      const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForTimeout(200);
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

// Standalone test: node render-cards.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const samples = [
    { type: 'statement', kicker: 'The first of its kind', statement: 'Disability was never the dealbreaker. <b>The apps were.</b>', support: 'So we built the first dating app where disabled and non-disabled people actually meet.', allowHtml: true },
    { type: 'split', personA: { name: 'Maya', initial: 'M', chip: 'Wheelchair user', grad: ['#B23AD8', '#E23349'] }, personB: { name: 'Tom', initial: 'T', grad: ['#FF8FA6', '#FFC64D'] }, messages: ['Your bio actually made me laugh out loud', 'Low bar for men, high bar for jokes', 'Coffee this week? Somewhere step-free, I already checked'] },
    { type: 'statTake', eyebrow: 'The disclosure dread is real', stat: '58%', claim: "of dating-app users with a health condition won't disclose it.", take: "That's not shyness. That's people bracing to be rejected for who they are. Exactly what we're here to end.", source: 'Source: Abbott, "Discrimidating" survey (UK)' },
    { type: 'flags', redBio: '"Love to laugh, love to travel, no drama."', redAside: 'A personality, or an airport?', greens: ['Asks instead of assumes', "Doesn't treat access needs like a favour", 'Knows a wheelchair is freedom, not a tragedy'] },
    { type: 'feature', eyebrow: 'Disclosure cards', headline: 'Your access needs. On a card, not a confession.', feature: 'disclosure', bubble: { label: 'Tap to reveal', h: 'Deaf. Wheelchair user. Guide dog.', s: "So the first message isn't the awkward one." } },
    { type: 'photo', eyebrow: 'Made for everyone', caption: 'They called us <b>a lot to take on.</b> The right person calls us home.', imageQuery: 'wheelchair user smiling phone', tag: '#Able2Love', allowHtml: true },
  ];
  const out = path.resolve(process.cwd(), 'content-queue/_sample');
  const files = await renderCards(samples, out);
  console.log('Rendered sample cards:\n' + files.join('\n'));
}
