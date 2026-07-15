// Post to X through the OFFICIAL X API (v1.1 media upload + v2 tweet create),
// signed with OAuth 1.0a user context. This is the sanctioned, ban-safe way to
// automate posting to your own account. Pay-per-use pricing applies on X's side.
//
// Required environment: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET

import crypto from 'node:crypto';

function pct(s) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauthHeader(method, url, extraParams = {}) {
  const {
    X_API_KEY: key, X_API_SECRET: keySecret,
    X_ACCESS_TOKEN: token, X_ACCESS_SECRET: tokenSecret,
  } = process.env;
  if (!key || !keySecret || !token || !tokenSecret) {
    throw new Error('X credentials missing (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)');
  }
  const oauth = {
    oauth_consumer_key: key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...extraParams };
  const paramString = Object.keys(all).sort().map((k) => `${pct(k)}=${pct(all[k])}`).join('&');
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join('&');
  const signingKey = `${pct(keySecret)}&${pct(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ');
}

async function uploadMedia(imageBytes) {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const form = new FormData();
  form.append('media', new Blob([imageBytes]), 'card.png');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', url) }, // multipart body is not part of the signature
    body: form,
  });
  if (!res.ok) throw new Error(`X media upload failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.media_id_string;
}

async function setAltText(mediaId, altText) {
  const url = 'https://upload.twitter.com/1.1/media/metadata/create.json';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_id: mediaId, alt_text: { text: altText.slice(0, 1000) } }),
  });
  // Alt text failing should not block the post; report and continue.
  if (!res.ok) console.warn(`X alt text failed ${res.status}: ${await res.text()}`);
}

export async function postToX({ text, imageBytes, altText }) {
  let mediaIds;
  if (imageBytes) {
    const id = await uploadMedia(imageBytes);
    if (altText) await setAltText(id, altText);
    mediaIds = [id];
  }
  const url = 'https://api.x.com/2/tweets';
  const body = mediaIds ? { text, media: { media_ids: mediaIds } } : { text };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`X tweet failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data?.id;
}
