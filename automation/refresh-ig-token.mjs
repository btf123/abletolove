#!/usr/bin/env node
/**
 * Refresh the long-lived Instagram token so it never lapses.
 *
 * Instagram long-lived tokens last ~60 days and can be refreshed any time after
 * 24 hours old. This calls the refresh endpoint and writes the NEW token to a
 * file (never to the log); the workflow then stores it back into the
 * IG_ACCESS_TOKEN secret with `gh secret set`. Run on a schedule well inside 60
 * days and the token is effectively permanent.
 *
 * Env: IG_ACCESS_TOKEN (current token). Writes: ig_new_token.txt (token only).
 */

import { writeFile } from 'node:fs/promises';

const token = process.env.IG_ACCESS_TOKEN;
if (!token) { console.error('No IG_ACCESS_TOKEN to refresh.'); process.exit(1); }

const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
const res = await fetch(url);
const data = await res.json().catch(() => ({}));

if (!res.ok || !data.access_token) {
  console.error(`Refresh failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  process.exit(1);
}

await writeFile('ig_new_token.txt', String(data.access_token).trim());
const days = Math.round((data.expires_in || 0) / 86400);
console.log(`Instagram token refreshed. New token valid ~${days} days. (Value written to a file, not printed.)`);
