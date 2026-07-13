# Able2Love Bot: the sign-up runbook

Everything needed to switch the bot on, in order, using the Claude Chrome extension to do the clicking. Two sign-ups and one merge. All free. Total hands-on time: roughly ten minutes.

## How this works

For each step: open the named website in Chrome, open the Claude extension, paste the briefing block, and approve its actions as it goes. It will ask permission before clicking; that is normal. If any screen asks for payment details, stop: nothing here needs a card.

---

## Step 1: Buffer (the mouth: what actually posts to X)

Open **buffer.com** in a tab, then paste this to the extension:

```
CONTEXT: I'm Brogan, founder of the dating app Able2Love. Set up a free
Buffer account so my posts publish automatically to X.
TASK:
1. Sign up for Buffer's FREE plan using "Continue with Google" (I'm
   signed in to Google in this browser). Skip or minimally answer any
   onboarding survey. Never enter payment details.
2. Connect a channel: choose X/Twitter, log in as @Able2LoveApp and
   authorise Buffer.
3. Set the posting schedule to once per day at 12:00.
4. Tell me when the channel shows as connected.
Do not connect any other accounts or change billing.
```

Then open the file `marketing/06-posting-setup-buffer.md` in the repo (GitHub website, branch `claude/dating-app-marketing-pqm1r3`), copy the first ten X posts, and paste this to the extension on the Buffer tab:

```
In this Buffer tab, add the following posts to my X queue in order, one
per day starting tomorrow. Do not change the wording. (Posts pasted
below this message.)
```

That is launch: posts start going out daily.

## Step 2: Gemini key (the brain: what writes new posts every Monday)

Open **aistudio.google.com/apikey** in a tab, then paste this to the extension:

```
CONTEXT: I'm Brogan (GitHub user btf123). Create a free Google Gemini
API key and save it as a GitHub Actions secret on my repo.
TASK:
1. On this page (Google AI Studio, I'm signed in), click "Create API
   key" (default project is fine) and copy the key.
2. Go to https://github.com/btf123/abletolove/settings/secrets/actions
   and click "New repository secret". Name: GEMINI_API_KEY
   Paste the key as the value and save.
3. Everything here is free. Do not enter payment details anywhere.
```

## Step 3: The on-switch (merging to main)

The Monday schedule only activates once the work branch merges into `main`. Ask Claude (the coding one) to open the pull request, then merge it with one click, or ask the extension:

```
Go to https://github.com/btf123/abletolove/pulls and merge the open
pull request from the branch claude/dating-app-marketing-pqm1r3.
```

## Step 4 (optional test): fire the brain once by hand

```
Go to https://github.com/btf123/abletolove/actions, open the workflow
"Content brain (weekly posts)", click "Run workflow" on the main
branch, wait for it to finish, then open the new issue it created and
read me the posts.
```

---

## What life looks like after setup

| When | What happens | Who does it |
|---|---|---|
| Every Monday 9am | The brain writes ~7 posts in the founder voice, filters them, opens a "Review this week's posts" issue | Automatic |
| Once a week, 2 min | Read the issue, bin anything you dislike, hand the keepers to the extension to load into Buffer | You + extension |
| Every day | Buffer publishes the next queued post to X | Automatic |

Costs: nothing. Cards: none. Developer forms: none.
