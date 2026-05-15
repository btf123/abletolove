# Social Media Growth Bot

Automated social media growth platform that discovers trends, generates content, schedules posts, auto-responds to comments, and tracks follower growth — all on autopilot.

## Supported Platforms

- TikTok (Content Posting API)
- Instagram (Graph API — images, reels, carousels)
- Twitter / X (API v2)
- YouTube (Data API v3 — Shorts)

## Quick Start

### 1. Prerequisites

- Node.js 22+
- Docker (for PostgreSQL + Redis)
- OpenAI API key
- OAuth tokens for at least one social media platform

### 2. Install dependencies

```bash
cd social-media-bot
npm install
```

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys:
# - OPENAI_API_KEY (required)
# - Platform OAuth tokens (at least one platform)
```

### 5. Run database migrations

```bash
npm run migrate -w apps/engine
```

### 6. Start the platform

```bash
# Start both engine and dashboard
npm run dev

# Or start separately:
npm run dev:engine     # Backend on port 4000
npm run dev:dashboard  # Dashboard on port 3000
```

### 7. Setup wizard

Open http://localhost:3000/setup to:
1. Connect your social media accounts
2. Configure your niche keywords and content tone
3. Set posting frequency

Once setup is complete, the bot runs automatically.

## How It Works

Once running, the system operates on a fully automated schedule:

| Schedule | Job | What happens |
|---|---|---|
| Every 4 hours | Trend Discovery | Scrapes Google Trends, TikTok Creative Center, X, YouTube for trending topics |
| Daily at 2 AM | Content Generation | Uses OpenAI to generate a week of posts from top trends |
| Every 15 min | Post Publisher | Publishes any posts scheduled for the current window |
| Every 30 min | Comment Responder | Fetches new comments and posts AI-generated replies |
| Every 6 hours | Analytics | Collects follower counts and engagement metrics |
| Daily midnight | Token Refresh | Refreshes OAuth tokens to prevent expiry |

## Dashboard

- **Dashboard** — overview stats, trending topics, platform breakdown
- **Content** — review, edit, approve/reject generated posts
- **Schedule** — calendar view of upcoming posts
- **Analytics** — follower growth and engagement charts
- **Engagement** — auto-reply log, flagged replies for review
- **Settings** — niche keywords, tone, posting frequency, connected accounts

## Architecture

```
social-media-bot/
├── packages/shared/          # Shared types and constants
├── apps/
│   ├── engine/               # Node.js automation backend
│   │   ├── platforms/        # TikTok, Instagram, X, YouTube adapters
│   │   ├── pipelines/        # Trending, content gen, engagement
│   │   ├── scheduler/        # BullMQ cron workers
│   │   └── analytics/        # Metrics collection
│   └── dashboard/            # Next.js web UI
└── docker-compose.yml        # PostgreSQL + Redis
```

## Getting Platform API Access

### Twitter / X
1. Go to https://developer.x.com
2. Create a project with OAuth 2.0 (User Authentication)
3. Set scopes: `tweet.read`, `tweet.write`, `users.read`
4. Complete OAuth flow to get access + refresh tokens

### TikTok
1. Go to https://developers.tiktok.com
2. Register an app, request Content Posting API access
3. Set scopes: `video.publish`, `video.list`, `comment.list`, `comment.list.manage`
4. Complete OAuth flow to get tokens + open_id

### Instagram
1. Create a Facebook Developer account at https://developers.facebook.com
2. Create an app with Instagram Graph API
3. Link your Instagram Business/Creator account
4. Generate a long-lived access token (valid 60 days, auto-refreshed)

### YouTube
1. Go to https://console.cloud.google.com
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Set scopes: `youtube.upload`, `youtube.force-ssl`
5. Complete OAuth flow to get tokens + channel ID

## Estimated Monthly Cost

| Service | Cost |
|---|---|
| OpenAI API (GPT-4o-mini) | ~$15-30 |
| X API (pay-per-post) | ~$2-3 |
| Hosting (VPS/Railway) | ~$10-20 |
| PostgreSQL + Redis | $0-10 |
| **Total** | **~$30-60** |

TikTok, Instagram, and YouTube APIs are free within rate limits.
