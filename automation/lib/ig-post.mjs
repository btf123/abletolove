// Post to Instagram through the OFFICIAL Instagram API (Content Publishing).
// Free for Business/Creator accounts, and the sanctioned, ban-safe way to
// automate posting to your own account.
//
// Uses the "Instagram API with Instagram Login" method (graph.instagram.com),
// which connects a Business/Creator account directly, with no Facebook Page
// required. Override the host with IG_GRAPH_BASE if ever needed.
//
// Required environment: IG_USER_ID (the Instagram-scoped account ID shown next
// to the account in the app's token page), IG_ACCESS_TOKEN (the long-lived
// token from that same page, with content-publishing permission).
//
// The image must be a PUBLIC URL; we use raw.githubusercontent.com links to
// the card PNGs in this public repo, so no separate image host is needed.

const GRAPH = process.env.IG_GRAPH_BASE || 'https://graph.instagram.com/v21.0';

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

// Wait for a media container to leave the "IN_PROGRESS" state.
async function waitReady(containerId, token) {
  for (let i = 0; i < 15; i++) {
    const st = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const { status_code } = await st.json();
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error('IG container entered ERROR state');
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// Post a multi-image CAROUSEL (the reveal "swipe" posts). imageUrls must be an
// ordered array of 2-10 PUBLIC image URLs; caption goes on the parent.
export async function postCarouselToInstagram({ imageUrls, caption }) {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) throw new Error('Instagram credentials missing (IG_USER_ID, IG_ACCESS_TOKEN)');
  if (!Array.isArray(imageUrls) || imageUrls.length < 2) throw new Error('carousel needs at least 2 images');

  // Step 1: a child container per image (is_carousel_item=true).
  const childIds = [];
  for (const url of imageUrls) {
    const r = await fetch(`${GRAPH}/${userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
    });
    if (!r.ok) throw new Error(`IG carousel child failed ${r.status}: ${await r.text()}`);
    const { id } = await r.json();
    await waitReady(id, token);
    childIds.push(id);
  }

  // Step 2: the parent carousel container.
  const parentRes = await fetch(`${GRAPH}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption: caption.slice(0, 2200), access_token: token }),
  });
  if (!parentRes.ok) throw new Error(`IG carousel parent failed ${parentRes.status}: ${await parentRes.text()}`);
  const { id: parentId } = await parentRes.json();
  await waitReady(parentId, token);

  // Step 3: publish.
  const pubRes = await fetch(`${GRAPH}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: parentId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`IG carousel publish failed ${pubRes.status}: ${await pubRes.text()}`);
  const data = await pubRes.json();
  return data.id;
}
