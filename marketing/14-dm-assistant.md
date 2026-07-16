# The DM assistant: a 24/7 support bot in your voice

An always-on assistant that answers Instagram DMs about the app in your voice, logs bugs, and hands anything sensitive to you. Inbound only: it only ever replies to people who message you first, so it is not the ban-risky "message strangers" kind of bot.

## What's already built (in this repo)
- `dm-bot/knowledge.md` — everything the bot knows (edit this any time; the live bot re-reads it, no redeploy).
- `dm-bot/persona.md` — its voice and the hard escalation rails (the safety core).
- `dm-bot/webhook-worker.js` — the always-on responder (a Cloudflare Worker).
- `dm-bot/test-brain.mjs` — try its answers/escalations from your terminal.

## What it does and does not do
- **Answers:** what the app is, cost, where to download, how features work, simple how-to, bug reports, how to reach you.
- **Hands off to you (does not improvise):** anything personal, emotional, flirtatious, about another user, safety, under-18, legal/money/data, or "are you a real person". It replies with a short "I'm the assistant, I've passed this to Brogan" and stops.
- **Crisis:** if someone is in distress or talks about self-harm, it does not counsel; it responds kindly, signposts Samaritans (116 123) / 999, and flags you.

## Before you switch it on: two decisions
1. **Set a support email.** In `dm-bot/knowledge.md`, replace `[SET_SUPPORT_EMAIL]` with a support address (make a free one like able2love.help@gmail.com; do NOT use your personal email, since the bot can share this with strangers).
2. **You need a privacy policy URL** for Meta's review (a simple page saying what data the app/bot handles). The landing page can host one; tell me and I'll write it.

## Setup (the part that needs your logins)

### A. Test the brain first (free, 2 min)
```
GROQ_API_KEY is already a repo secret. On any machine with Node:
  GROQ_API_KEY=your_key node dm-bot/test-brain.mjs "how do I sign up?"
  node dm-bot/test-brain.mjs "are you a bot?"
  node dm-bot/test-brain.mjs "someone is harassing me"
Check it answers the first, owns being a bot on the second, and escalates the third.
```

### B. Deploy the responder (free, Cloudflare)
Hand the extension this:
```
CONTEXT: I'm Brogan. Deploy a Cloudflare Worker (free plan, no card). At dash.cloudflare.com, create a Worker named "able2love-dm". Paste in the code from my repo file dm-bot/webhook-worker.js (raw: raw.githubusercontent.com/btf123/abletolove/main/dm-bot/webhook-worker.js) and deploy it. Then in the Worker's Settings > Variables add these (as encrypted where offered): VERIFY_TOKEN (make up a random string and tell me it), GROQ_API_KEY (my Groq key), and leave APP_SECRET and PAGE_ACCESS_TOKEN to add after the Meta step. Give me the Worker's public URL (like https://able2love-dm.<name>.workers.dev). If a card is ever requested, pause and hand back to me.
```

### C. Meta app: turn on Instagram messaging (the slow bit)
Instagram DM automation needs Meta to approve messaging permissions. This is a review that can take a few days.
```
CONTEXT: I'm Brogan (logged in to Facebook/Instagram). Using my existing "able2love-publisher" Meta app at developers.facebook.com: add the "Messenger" / "Instagram" product and connect my @able2loveapp Business account and its linked Facebook Page. Set the webhook callback URL to my Cloudflare Worker URL and the Verify Token to the VERIFY_TOKEN string I gave you; subscribe to the "messages" field. Copy the App Secret and a Page Access Token, and save them into the Cloudflare Worker's variables as APP_SECRET and PAGE_ACCESS_TOKEN. Then submit for App Review requesting the instagram_manage_messages (and human_agent if offered) permission, using this use case: "An automated support assistant that answers inbound customer questions about our app and escalates anything else to a human." Use my privacy policy URL. Tell me each step's status; if anything asks for payment, pause and hand back to me.
```

### D. Go live
Once Meta approves and the four Worker variables are set, DM the account from another account and watch it reply. In the app settings turn OFF Instagram's own basic auto-reply if it has one, so only this bot answers.

## Keeping it safe once live
- Skim your Instagram inbox now and then: the bot leaves every escalated/crisis message in the inbox for you, so you can follow up as a human.
- Edit `dm-bot/knowledge.md` whenever the app changes; the bot updates itself.
- If it ever answers something wrong, tell me the message and I'll tighten the rails.
- The Groq usage is free; the Worker is free; the only cost is nil unless volume gets very high.
