# The Free Bot — how Able2Love's marketing runs itself for £0

The custom bot, hosted for free. The trick: split the bot into a **brain** and a **mouth**, and give each the free home it fits.

## Why it's split (the honest bit)

X shut its free API tier in early 2026 — every app that posts to X directly now pays per post. That toll applies to *any* bot we build or host, no matter where it runs. The only way to post to X for £0 is through a partner app with a free plan (Buffer). So:

| Part | What it does | Where it lives | Cost |
|---|---|---|---|
| 🧠 **Brain** (ours, custom) | Writes a week of on-brand posts every Monday, runs the brand-guardrail filter, files the batch for your review | **GitHub Actions** — free scheduler on this repo | £0 |
| 📋 **Review desk** | You read the batch, edit/delete anything, keep the good ones | A GitHub Issue opened for you automatically each week | £0 |
| 👄 **Mouth** | Actually posts to X / Instagram on schedule | **Buffer** free plan (see `06-posting-setup-buffer.md`) | £0 |

Nothing to host, nothing to keep running, no servers, no database. The repo is the database; GitHub runs the robot.

## The weekly rhythm (what your life looks like)

1. **Monday 9am:** the brain wakes up and plans 7 days on that week's theme (themes rotate: green flags, accessibility, community stories, gentle myth-busting...). Each day gets a matched pair, one post for X and one for Instagram on the same subject, plus a card image used on both, so the two platforms stay in lockstep. It bins anything that violates the banned-language guardrails and **opens a GitHub Issue titled "Review this week's Able2Love posts."**
2. **You (2 minutes):** read the Issue. Delete/edit what you don't like.
3. **Paste the keepers into Buffer** — or hand the batch to your Claude browser extension and let it load the queue for you.
4. Buffer posts them through the week. Done.

## One-time setup (one free key, two clicks)

The brain needs a free Google Gemini key to write with:

1. Go to **aistudio.google.com/apikey** (sign in with your Google account) → **Create API key** → copy it.
2. In GitHub: your repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `GEMINI_API_KEY`
   - Value: paste the key → save.

That's the entire setup. (Your Claude browser extension can do both steps — see the briefing below.)

> The workflow schedule activates once this branch is merged to `main`. You can also fire it manually any time: repo → **Actions → "Content brain (weekly posts)" → Run workflow**.

### Extension briefing (paste to the Claude Chrome extension)

```
CONTEXT: I'm Brogan (GitHub user btf123). I need a free Google Gemini API
key created and saved as a GitHub Actions secret on my repo btf123/abletolove.
TASK:
1. Go to https://aistudio.google.com/apikey — I'm signed in to Google.
   Click "Create API key" (default project is fine) and copy the key.
2. Go to https://github.com/btf123/abletolove/settings/secrets/actions
   Click "New repository secret". Name: GEMINI_API_KEY
   Paste the key as the value. Save.
3. Then go to the repo's Actions tab, find "Content brain (weekly posts)",
   and click "Run workflow" to test it.
Do not enter any payment details anywhere; every step here is free.
```

## The pieces in this repo

- `automation/generate-week.mjs` — the brain. Reads the brand rules from `social-media-bot/config/abletolove.niche.json`, plans 7 aligned days with Gemini (a matched X post and Instagram post per day), filters with the banned-language guardrails, renders a card per day, and writes `content-queue/week-<date>/`.
- `automation/lib/render-cards.mjs` — turns each day's headline into a branded card image.
- `.github/workflows/content-brain.yml` — the free scheduler: every Monday, plus a manual Run button.
- `content-queue/week-01/` — the first week, built by hand, showing the format.
- `marketing/06-posting-setup-buffer.md` — the mouth: Buffer setup + the 38 launch posts.


## Instagram and X, in tandem

Every Monday the brain produces one folder, `content-queue/week-<date>/`, containing:
- `schedule.md` — seven days. Each day has the **Instagram** caption (long, with hashtags and alt text) and the **X** caption (tight) for the same subject.
- `card-01.png` ... `card-07.png` — one image per day, used on **both** platforms.

So Instagram and X post the same theme, the same day, at your peak time. Instagram refuses to post without an image, which is why every day ships with a card.

The images are typographic brand cards, not fake photos of people. That is deliberate: auto-generating fake "disabled daters" would break the representation rules in the founder prompt. Real photos and reels (and the real-screenshot feature images in `marketing/brand-assets/`) stay something you add by hand when you have them.

### Connecting Instagram for posting
1. Make sure the Instagram account is a **Business or Creator** account (Instagram app: Settings, Account type and tools, Switch to professional account). Buffer can only auto-publish to professional accounts.
2. In Buffer, connect the Instagram channel (same "Connect channel" flow as X).
3. Each week, load each day's card + both captions from `content-queue/week-<date>/` into Buffer (the Instagram caption to the Instagram channel, the X caption to the X channel), or hand the folder to the Claude browser extension.

## If you ever want zero-touch posting (the paid upgrade)

The full engine in `social-media-bot/` still exists and can post to X directly with **pay-per-use API pricing** (~1.5¢ per post, ~20¢ if it contains a link — a few pounds a month at our volume, plus the developer.x.com signup). That's the only step up from here, and it buys removing the 2-minute weekly paste. Until that trade feels worth it, this setup does everything for free.
