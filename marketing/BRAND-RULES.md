# Able2Love — Brand & Content Rules (the master plan)

**This file is ADDITIVE. Every instruction Brogan gives is added here, never
silently swapped for another. Nothing is removed unless it is genuinely
problematic — and if it is, that gets flagged to him, not quietly dropped.**

Last updated: 2026-07-21.

---

## 1. Identity — Brogan is NOT the face of the app
- Brogan's face (and every other person's face) must be **unidentifiable** in
  every image ever posted. No exceptions, no matter whose face it is.
- The method is the **eye bar** (see §2), NOT blurring, pixelating, or cropping
  the head off (those look like hiding / look weird). We show the whole person;
  we just cover the eyes.
- Raw source photos (which show eyes) are NEVER committed to the repo. Only the
  eyes-covered 1080×1350 bases go in `marketing/brand-assets/reveal-library/`.

## 2. The eye bar = brand iconography (a running theme on EVERY visual post)
- It only covers the **eyes** — the part we're actually hiding. It does **not**
  take up a big band across the face. Thin.
- It is **pretty and on-brand**: brand colours (red→magenta→purple gradient,
  gold hairline), NOT an ugly black censor block.
- Every person in the shot still needs to look good — the bar is a design
  element, not a redaction.
- The bar **always carries words** — never blank. Two jobs:
  1. **Post words**: the swipe/test hook — SMASH OR PASS? / YES OR NO? /
     SWIPE LEFT OR RIGHT? / HOT OR NOT? etc.
  2. **App connection**: a tag tying it to Able2Love.
- It works like a **test**: people swipe to answer "would you?", and in doing so
  they find the app. That's the mechanic on every image.

## 2a. Layout rules for the swipe-reveal post (added 2026-07-21)
- **Every post = exactly TWO images** (an Instagram carousel; the swipe is what
  makes the reveal work, and swipe only exists on Instagram).
- **ONE bar per image.** The swipe-reveal is a single fake dating profile, so
  it uses SOLO photos of Brogan only (one face → one bar). Photos with other
  people (two+ faces) are a DIFFERENT post format, not the swipe card — because
  hiding every face there needs more than one bar.
- **Fake dating-profile identity**: a fake name + age + location line at the
  bottom (e.g. "Alex, 26 · Manchester · 2 miles away"), so it reads like a real
  profile and triggers the gut reaction. Never Brogan's real name.
- **Swipe buttons always at the bottom**, on BOTH images.
- Don't show the full body four times — slide 1 is a portrait-style crop, slide
  2 is the fuller reveal. Same photo, two framings.

## 2b. Twitter/X (no swipe there) — how the reveal converts
- Recommended: a short **auto-playing video** — opens on the cropped bait +
  question, holds, then zooms out to reveal the wheelchair. Recreates the swipe
  in-feed. (Buildable with ffmpeg.)
- Alternatives: a two-tweet thread (bait tweet, reveal in the reply), or two
  images in one tweet (weaker — both show at once).

## 2c. Eye bar + background look (added 2026-07-21, supersedes earlier bar style)
- **SHORT bar only** — Cops-style, spans just the face/eyes, NOT the full image
  width. Rounded ends, brand gradient, thin gold hairline. Never black, never
  ugly, never full-width.
- The bar carries a **short fun flirty binary phrase**: hot or not / smash or
  pass / fit or no / bae or no / hit or miss / left or right / yes or no.
  Nothing severe or clinical. They all cheekily mean the same thing.
- **Background**: white studio backgrounds are recoloured with the brand
  gradient (multiply blend) so the white becomes brand colour — an on-brand,
  editorial, cut-out feel WITHOUT a real cutout. (True cutout needs an AI
  matting model the sandbox can't download yet; revisit if that changes.)
- Take creative licence with the colours and design — but always keep the short
  bar, the fun phrase, and every face covered.

## 3. The reveal carousel (same-picture swipe)
- Two slides from the **SAME photo**. Slide 1 = tight crop that hides the
  wheelchair (reads as an ordinary portrait). Slide 2 = the full frame, chair
  and all. The zoom-out IS the reveal: "See the full picture."
- Dating-app UI (generic, trademark-safe): segmented photo bars top, swipe
  buttons (↺ ✕ ★ ♥ ⚡) bottom, so the thumb itches to swipe.
- Copy is rhetorical / engagement-bait (comments, arguments), not a tidy lesson.
- Rotates images + copy weekly so it never repeats. ~1 in every 4–5 posts.

## 3a. VARY the visuals — not every post is the gradient reveal (added 2026-07-21)
- The brand-gradient short-bar reveal is ONE look, not the only look. Do NOT
  make every image like this. Mix it up: reveals (~1 in 5), stat/testimony
  cards, statement cards, barrier photos, with-people shots, split-screen, etc.
- Even within reveals, vary the treatment over time (backgrounds, crops, copy)
  so the feed never looks samey.

## 3b. Twitter/X reveal = auto-play video (built 2026-07-21)
- Every reveal now also renders `reveal_x.mp4`: holds on the bait, swipe-left
  transition, reveals the full frame + wheelchair, holds. Auto-plays in the X
  feed to recreate the swipe. (make_video.py via a full ffmpeg.)

## 4. "Sexy reveal" strand
- ~40% of visual imagery = this sexy imagery of Brogan (in or out of chair,
  looking incredible). Pick the most conventionally attractive frames.
- Neutral third-person framing ("this person"), never self-flattery.

## 5. "Out with people" strand (IMPORTANT, growing)
- Photos of Brogan **out and about, WITH people, in the chair, doing things** —
  gigs, pubs, parties, selfies with mates. Someone in a wheelchair with someone
  who isn't. This is core to the message.
- **Every** face in these gets the eye bar too.
- **Consent**: Brogan confirms explicit permission from all friends shown; all
  identities are concealed regardless.

## 6. Stats / underserved strand
- ≥20% of posts = real, sourced statistics + lived testimony about how disabled
  people are underserved (dating, venues, attitudes).
- HARD RULE: never invent a number. Only sourced stats from `stats-pool.mjs`.

## 7. Voice (weekly written posts)
- Brogan's voice: warm, funny, dry, first-person, angry at the *barriers* never
  at disabled people. Sea-change energy. Bring the lived personal cost.
- Every post a different shape. No formula openings. No inspiration-porn.
- The umbrella (idea source, never a slogan): the world keeps finding new ways
  to divide people; Able2Love brings them together.

## 8. Hard formatting rules
- **No em dashes or en dashes** in any public copy. The post-time guardrail
  rejects them (build-reveal auto-converts them to commas).
- Never call out a specific real venue by name for a barrier post.

## 9. Ban-safety (top priority, always)
- Official APIs only (X API, Instagram Graph). No scraping, no fake engagement.
- Human-in-the-loop: nothing posts until Brogan releases the week.
