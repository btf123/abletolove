#!/usr/bin/env node
/**
 * One-off cleanup: delete specific old X posts that predate the voice fix and
 * do not match the current direction (they used the retired "testimony /
 * vanishing act" register the founder explicitly killed).
 *
 * This is a HARD-GATED, explicit action. It will not run unless:
 *   - CONFIRM_DELETE=yes-delete-old-posts is set, AND
 *   - it is pointed at exactly the tweet ids below (edit the list to change scope).
 *
 * Instagram note: Meta's Graph API does not offer a delete-media endpoint for
 * posts published via the API, so the 2 old Instagram posts are NOT handled
 * here. Delete those by hand in the Instagram app (open the post, ... , Delete).
 *
 * Run: CONFIRM_DELETE=yes-delete-old-posts node automation/delete-old-posts.mjs
 */

import { deleteTweet } from './lib/x-post.mjs';

// The 4 tweets logged in content-queue/posted-log.json before the voice fix
// (week-2026-07-15, days 1, 2, 3, 5). Edit this list for any future cleanup.
const TWEET_IDS = [
  '2077542591713935725', // day 1
  '2077711583774404938', // day 2
  '2078072086824939818', // day 3
  '2078791346219851859', // day 5
];

async function main() {
  if (process.env.CONFIRM_DELETE !== 'yes-delete-old-posts') {
    console.log('Not confirmed (set CONFIRM_DELETE=yes-delete-old-posts to run). Doing nothing.');
    console.log(`Would delete ${TWEET_IDS.length} tweet(s): ${TWEET_IDS.join(', ')}`);
    return;
  }
  let ok = 0; let failed = 0;
  for (const id of TWEET_IDS) {
    try {
      await deleteTweet(id);
      console.log(`Deleted ${id}`);
      ok++;
    } catch (e) {
      console.error(`Failed to delete ${id}: ${e.message.slice(0, 200)}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`Done: ${ok} deleted, ${failed} failed.`);
}

main().catch((e) => { console.error('Cleanup failed:', e.message); process.exit(1); });
