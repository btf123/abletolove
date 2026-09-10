// Keep the "watch together" whitelist honest.
//
// Live stream ids rot. Broadcasters restart a stream and the id changes, and
// the old one becomes "Video unavailable" forever. Four of the first six we
// shipped were dead within days, and the only reason we found out was that
// Brogan opened the room and saw YouTube's error card. That is not a way to
// run it.
//
// So: every day, check each `video` entry in `watch_channels` against
// YouTube's own watch page, and switch off anything that is no longer live,
// no longer playable, or no longer embeddable. `channel` entries are skipped
// because a channel embed follows whatever that channel is streaming now, so
// there is no id to go stale. That is why new entries should be channels
// wherever the broadcaster has one.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (required), SUPABASE_URL (optional).

import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgmkughenxaictoqyoop.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY is not set'); process.exit(1); }

const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'return=representation' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/**
 * Ask YouTube's own watch page about a video. We read three things out of the
 * page's embedded JSON: whether it can be played at all, whether it is live
 * right now, and whether the uploader still allows embedding. All three have
 * to be true for a stream to earn its place on the list.
 */
async function inspect(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      headers: { 'user-agent': UA, 'accept-language': 'en-GB,en' },
    });
    if (!res.ok) return { ok: false, why: `page ${res.status}` };
    const body = await res.text();
    const status = (body.match(/"playabilityStatus":\{"status":"([A-Z_]+)"/) || [])[1] || 'UNKNOWN';
    const live = body.includes('"isLiveNow":true');
    const embeddable = body.includes('"playableInEmbed":true');
    if (status !== 'OK') return { ok: false, why: `not playable (${status})` };
    if (!embeddable) return { ok: false, why: 'embedding turned off by the uploader' };
    if (!live) return { ok: false, why: 'the live stream has ended' };
    return { ok: true };
  } catch (e) {
    // A network wobble must not switch off a perfectly good stream.
    return { ok: null, why: `could not check: ${e.message}` };
  }
}

const rows = await rest('watch_channels?select=id,label,by_name,kind,ref,active&order=sort');
const videos = rows.filter(r => r.kind === 'video');
console.log(`${rows.length} entries, ${videos.length} to check (channel embeds never go stale)`);

const broken = [];
const revived = [];

for (const row of videos) {
  const r = await inspect(row.ref);
  if (r.ok === null) { console.log(`  ? ${row.label}: ${r.why}`); continue; }
  if (!r.ok && row.active) {
    await rest(`watch_channels?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
    broken.push({ ...row, why: r.why });
    console.log(`  x ${row.label} (${row.by_name}) switched off: ${r.why}`);
  } else if (r.ok && !row.active) {
    await rest(`watch_channels?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ active: true }) });
    revived.push(row);
    console.log(`  + ${row.label} is back, switched on again`);
  } else {
    console.log(`  ${r.ok ? 'ok' : '--'} ${row.label}`);
  }
}

const stillOn = rows.filter(r => r.active && !broken.some(b => b.id === r.id)).length + revived.length;

const lines = [];
if (broken.length) {
  lines.push(`${broken.length} stream${broken.length === 1 ? '' : 's'} in the Watch together room stopped working and ${broken.length === 1 ? 'has' : 'have'} been switched off automatically.`);
  lines.push('');
  for (const b of broken) lines.push(`- **${b.label}** (${b.by_name}) — ${b.why}`);
  lines.push('');
  lines.push(`${stillOn} still working. Nothing is broken for members: the app skips anything switched off.`);
  lines.push('');
  lines.push('To replace one, add a row to `watch_channels` in Supabase. Prefer `kind = channel` with the broadcaster\'s channel id, because a channel embed follows whatever they are streaming and never goes stale. Only first-party channels: the broadcaster streaming their own content.');
}
writeFileSync('stream-check.md', lines.join('\n'));
writeFileSync('stream-check.json', JSON.stringify({ checked: videos.length, broken: broken.length, revived: revived.length, stillOn }));
console.log(lines.join('\n') || `All good. ${stillOn} streams on.`);
