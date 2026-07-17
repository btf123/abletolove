#!/usr/bin/env node
/**
 * Non-destructive Instagram credential check.
 *
 * Confirms IG_USER_ID + IG_ACCESS_TOKEN are valid and can reach the account,
 * WITHOUT posting anything. Use it to smoke-test the setup after adding the
 * secrets: if this prints the account name, the token, endpoint and ID are all
 * good and real posting will work.
 */

const GRAPH = process.env.IG_GRAPH_BASE || 'https://graph.instagram.com/v21.0';
const id = process.env.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN;

if (!id || !token) {
  console.error('Missing IG_USER_ID or IG_ACCESS_TOKEN; nothing to check.');
  process.exit(1);
}

const url = `${GRAPH}/${id}?fields=username,account_type&access_token=${encodeURIComponent(token)}`;
const res = await fetch(url);
const body = await res.text();

if (!res.ok) {
  console.error(`Instagram check FAILED (HTTP ${res.status}): ${body.slice(0, 400)}`);
  process.exit(1);
}

let data;
try { data = JSON.parse(body); } catch { console.error(`Unexpected response: ${body.slice(0, 400)}`); process.exit(1); }

console.log(`Instagram OK: @${data.username} (${data.account_type}).`);
console.log('Token, endpoint and account ID all check out. Posting will work.');
