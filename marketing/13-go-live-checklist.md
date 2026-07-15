# Go live: the whole thing, in order

Three outcomes: X posts automatically, live news works, ban risk is as low as it can be. Do the steps top to bottom. Free unless it says PAID.

## Step 1 — get your £10 back from Google (PAID money, your money)
It landed in the wrong one of your two identically-named billing accounts. Hand the extension:
```
At console.cloud.google.com/billing, check the balance on BOTH my "My Maps Billing Account" accounts, tell me which holds the £10, and whether it can be refunded. Make no payments and spend nothing. Just report back.
```
Whatever it says, this does NOT block anything below. Sort it in parallel.

## Step 2 — two FREE keys (the brain + live news)
```
Get me two free API keys, no card on either:
1. console.groq.com/keys -> create key -> save as GitHub secret GROQ_API_KEY on btf123/abletolove.
2. app.tavily.com -> copy my key -> save as GitHub secret TAVILY_API_KEY.
Confirm neither asked for payment.
```
This makes the writing brain and the real-time news work, for £0.

## Step 3 — PAID: X posting through the official API
This is the bit you actually wanted to pay for. ~1.5p per post, roughly 45p/month at one post a day with no link in the tweet (ours keep the link in the bio). Needs a card on X's side.
```
Set up official X API posting for @Able2LoveApp (I'm logged in). At developer.x.com sign up for pay-per-use, accept terms, create a Project + App named "able2love-publisher". Set App permissions to Read and write. Generate: API Key, API Key Secret, Access Token, Access Token Secret (the access token must be for @Able2LoveApp, read-write). Save them at github.com/btf123/abletolove/settings/secrets/actions as four secrets named exactly: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET. If a card is required, PAUSE and hand back to me. Do not buy Basic or Pro; pay-per-use only.
```

## Step 4 — throw the switch
Repo -> Settings -> Secrets and variables -> Actions -> Variables tab -> New variable: name `AUTOPOST`, value `on`.
To stop everything instantly, ever: set it to `off`.

## Step 5 — prove it
Repo -> Actions -> "Auto publisher (daily post)" -> Run workflow -> main. It waits a random few minutes (anti-bot), then posts today's card to X. Check @Able2LoveApp.

That's it. From then on: X posts itself daily, the morning brief brings you live news with drafted replies, and the Monday brain writes next week. Instagram keeps running free on Buffer (or add the free Meta keys later to move it onto the API too).

---

# What actually protects you from a ban (read once)

No one can promise zero risk. But here is everything the bot does to stay on the safe side, and what only you can do.

## What the bot does (built in)
- **Official API only.** It posts your own content to your own account through X's paid, sanctioned API. This is the lowest-risk automation there is; it is what schedulers do.
- **One post a day, hard cap.** Volume is what trips spam systems. One a day is nothing.
- **Human-like timing.** It never fires on the exact same second; it waits a random slice (up to ~22 min) so it does not look machine-timed.
- **No links in the tweet.** Link-stuffing is a spam signal (and costs more); ours keep the link in the bio.
- **No duplicate posts.** A ledger blocks re-posting the same day; the brain writes fresh copy each week.
- **No replying to strangers.** The single biggest ban trigger. The bot never does it. Outreach replies are drafted for you to send by hand.
- **Kill switch + alerts.** `AUTOPOST=off` stops it dead; any failure opens a loud issue.

## What only you can do (the human bit that matters most)
- **Do not mass-follow, mass-like, or DM strangers** from the account. That is what gets new accounts killed, and no code can stop you doing it by hand.
- **Keep the profile complete and real** (done: photo, bio, link) — bare accounts look like bots.
- **Warm it up.** A brand-new account that suddenly automates looks suspicious. For the first week or two, log in normally, like and reply to a few things by hand, be a person. Let the auto-posting be one small part of a real-looking account.
- **Send outreach replies yourself** from the morning brief. Never wire them to auto-send.
- **If you ever get a warning, stop and tell me.** We back off immediately rather than pushing through it.

Do those, and you are in the safest realistic position: sanctioned tools, low volume, human-paced, no stranger spam, fully recoverable because everything lives in the repo.
