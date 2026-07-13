# Able2Love — Marketing Autopilot

This is the "I don't want to make content" setup. The bot writes everything, schedules everything, and posts everything. **Your only job is to tap Approve** — nothing goes out without it, so nothing stupid ever gets posted.

## How it works (30 seconds)

```
The bot writes posts  ──►  They wait in your Content queue  ──►  You tap Approve  ──►  Bot posts them at the right time
        ▲                                                                                        │
        └────────────────── repeats forever (daily AI posts + the 30-day campaign every year) ◄──┘
```

Three layers of protection before anything reaches the internet:
1. **Brand guardrails** are baked into the AI's instructions (no pity language, no "inspiring", no cringe).
2. **A banned-language filter** automatically bins anything that slips through — you never even see it.
3. **You approve every post.** No approval, no post. The publisher physically cannot send a draft.

## One-time setup (do this once)

1. Follow the [README](./README.md) Quick Start to get the bot running (install, Docker, `.env` with your OpenAI key, migrations).
2. Connect at least your **Twitter/X account** in the setup wizard at `http://localhost:3000/setup` (X is fully automatic — it's text-only; Instagram/TikTok need a picture or video attached, so start with X).
3. Run the campaign loader:
   ```bash
   CAMPAIGN_LINK=https://your-waitlist-link.com npm run setup:abletolove
   ```
   This loads the Able2Love brand settings and drops the entire 30-day launch campaign (38 pre-written posts) into your review queue.

## Your weekly routine (the only work you have)

1. Open the dashboard → **Content** → tap the **draft** filter.
2. Read each post. Like it? Hit **Approve**. Don't? **Edit** it or delete it.
3. That's it. Approving automatically schedules the post for its planned day and time. The bot publishes it, replies to comments, and tracks the numbers.

A few minutes, once or twice a week. Everything else is automatic.

## What happens automatically

| When | What |
|---|---|
| Daily 2 AM | The AI writes fresh on-brand posts from trending topics → into your review queue |
| Every 15 min | Anything you approved gets published when its time comes |
| Every 30 min | The bot drafts replies to comments (sketchy ones get flagged for you instead of sent) |
| Every 6 hours | Follower + engagement stats collected |
| Daily 1 AM | Campaign check: **once a year**, the 30-day launch campaign re-seeds itself into your queue for the next run |

## Things worth knowing

- **Instagram posts** in the queue are marked `[⚠ attach media before approving]` — Instagram requires an image, and the dashboard can't attach one yet. Approve the X posts freely; handle Instagram when you have pictures.
- **Change the waitlist/download link** anytime: dashboard → Settings, or set the `campaign_link` config. The yearly re-seed picks it up.
- **Want it to start on a specific date?** Set the `campaign_start_date` config (ISO date) before running setup; otherwise the campaign starts tomorrow.
- **The brand rules** live in `config/abletolove.niche.json`. The banned-language list there is enforced by a machine — the AI literally cannot get pity-copy into your queue.
