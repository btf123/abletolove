// Post to Instagram through the OFFICIAL Meta Graph API (Content Publishing).
// Free for Business/Creator accounts, and the sanctioned, ban-safe way to
// automate posting to your own account.
//
// Required environment: IG_USER_ID (the Instagram Business account's numeric
// ID), IG_ACCESS_TOKEN (a long-lived token with instagram_content_publish).
//
// The image must be a PUBLIC URL; we use raw.githubusercontent.com links to
// the card PNGs in this public repo, so no separate image host is needed.

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function postToInstagram({ imageUrl, caption }) {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) throw new Error('Instagram credentials missing (IG_USER_ID, IG_ACCESS_TOKEN)');

  // Step 1: create the media container.
  const createRes = await fetch(`${GRAPH}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption: caption.slice(0, 2200), access_token: token }),
  });
  if (!createRes.ok) throw new Error(`IG container failed ${createRes.status}: ${await createRes.text()}`);
  const { id: containerId } = await createRes.json();

  // Step 2: wait for the container to be ready (usually seconds).
  for (let i = 0; i < 10; i++) {
    const st = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const { status_code } = await st.json();
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR') throw new Error('IG container entered ERROR state');
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Step 3: publish.
  const pubRes = await fetch(`${GRAPH}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`IG publish failed ${pubRes.status}: ${await pubRes.text()}`);
  const data = await pubRes.json();
  return data.id;
}
