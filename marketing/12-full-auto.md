# Full auto-posting: how it works and how to switch it on

From now on the machine posts by itself. The weekly brain writes the posts (Monday), and a **publisher robot** posts each day's pair to X and Instagram at 9:00 through the platforms' **official APIs**. No Buffer step, no human hand.

## Why this is the safe version (the bit that matters most)

- **Official APIs only.** Posting your own content to your own accounts via the platform's API is the sanctioned, sold-to-businesses path. It is how every scheduling tool works. One post per platform per day is nowhere near any limit.
- **What stays human:** replying to strangers. X's automation rules prohibit automated unsolicited replies/mentions, and Instagram bans automated engagement outright, with no API for it at all. Auto-commenting can only be done by browser-puppeting a logged-in session, the most-banned pattern there is. So the outreach scout still drafts replies every morning and you approve with one tap. That approval IS the ban-proofing; nobody can sell you a safe version without it.

## The safety net built into the publisher

1. **Kill switch.** The robot runs only while the repo variable `AUTOPOST` is `on`. Set it to `off` and everything stops instantly.
2. **One post per platform per day, hard-capped.**
3. **A ledger** (`content-queue/posted-log.json`): a day that has posted can never post twice, even if the workflow re-runs.
4. **Guardrails re-checked at post time**: banned language, em dashes, X length. A violation blocks the post and raises an issue instead.
5. **Per-day hold:** set `"hold": true` on any day in `week.json` and the publisher skips it (See Me First stays held like this until the app fix is confirmed).
6. **Loud failure:** any problem opens a ⚠️ GitHub issue; nothing fails silently.

## What you still see

Every Monday the brain still opens the review issue with the whole week. You now have from Monday until each day's 9:00 slot to edit or hold anything; if you do nothing, it posts. Control without chores.

## One-time setup (two credential handshakes)

The robot needs official keys for your two accounts, stored as GitHub secrets. Costs: Instagram publishing is **free**; X's API is **pay-per-use** (fractions of a penny per post, roughly £1 or less a month at one post a day, billed by X to a card on your developer account).

### A. X (developer account + keys)
Paste to the Claude extension:
```
CONTEXT: I'm Brogan. Set up official X API posting for my app's account
@Able2LoveApp (I'm logged in). At developer.x.com sign up for the
pay-per-use developer account with @Able2LoveApp, accept the terms, create
a Project and App named "able2love-publisher". In the app's settings, set
App permissions to "Read and write". Then from Keys and Tokens generate:
API Key, API Key Secret, Access Token, Access Token Secret (the access
token must be for @Able2LoveApp with read-write). Then go to
https://github.com/btf123/abletolove/settings/secrets/actions and save
them as four repository secrets named exactly:
X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.
If a payment card is required for pay-per-use, pause and hand back to me
to enter it myself. Do not buy any subscription tier.
```

### B. Instagram (Meta app + token)
Paste to the Claude extension:
```
CONTEXT: I'm Brogan. Set up official Instagram Graph API publishing for my
Instagram Business account @able2loveapp (I'm logged in to Instagram and
Facebook). At developers.facebook.com create an app (type Business) named
"able2love-publisher". Add the Instagram product. Link my Instagram
Business account. Using the Graph API tools, get: (1) my Instagram
Business account's numeric user ID, and (2) a long-lived access token with
the instagram_content_publish permission. Then save them at
https://github.com/btf123/abletolove/settings/secrets/actions as two
repository secrets named exactly: IG_USER_ID and IG_ACCESS_TOKEN.
Note: the long-lived token expires after about 60 days; note the expiry
date and tell me so I can diarise a refresh. Everything here is free; do
not enter payment details.
```

### C. Throw the switch
Repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable: name `AUTOPOST`, value `on`.
(To stop everything at any time: change it to `off`.)

## The handover week

Week-01 was loaded into Buffer by hand and finishes on 19 July; Buffer posts it. The publisher only reads dated folders (`week-YYYY-MM-DD`), so its first week is the one the brain generates on Monday 20 July. No overlap, no double-posting. Once that first automated week runs cleanly, Buffer can be quietly retired.

## Token upkeep

- The Instagram long-lived token lasts ~60 days. When the ⚠️ issue says the IG post failed with an auth error, re-run prompt B to mint a fresh token.
- X keys do not expire unless you regenerate them.
