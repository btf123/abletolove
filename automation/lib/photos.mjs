// License-clear photo fetching for photo-led cards, via Pexels (free).
//
// Pexels licence: free to use, modification allowed, commercial use allowed, no
// attribution required (https://www.pexels.com/license/). We still record the
// photographer per image for goodwill and traceability.
//
// Runs inside GitHub Actions (which has open internet). If PEXELS_API_KEY is not
// set, or a fetch fails, every function degrades gracefully to null and the
// renderer falls back to a photo-free version of the card. The pipeline never
// breaks for want of a photo.
//
// Env: PEXELS_API_KEY (get a free one at https://www.pexels.com/api/).

const API = 'https://api.pexels.com/v1/search';

export function hasPexels() {
  return !!process.env.PEXELS_API_KEY;
}

// Fetch one photo for a query. `pick` rotates the choice so repeated queries in
// one week don't all return the identical top result. Returns
// { b64, mime, photographer, url } or null.
export async function fetchPhoto(query, { orientation = '', pick = 0, exclude = [], prefer = [] } = {}) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const perPage = 40;
    // Only constrain orientation when explicitly asked. Niche, high-signal
    // queries (e.g. "deaf couple sign language") have far fewer photos, and the
    // card crops with object-fit anyway, so an unconstrained search finds a
    // genuinely representative image far more often than a square-only one.
    const url = `${API}?query=${encodeURIComponent(query)}&per_page=${perPage}${orientation ? `&orientation=${orientation}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) { console.warn(`Pexels HTTP ${res.status} for "${query}"`); return null; }
    const data = await res.json();
    let photos = Array.isArray(data.photos) ? data.photos : [];
    if (!photos.length) { console.warn(`Pexels: no photos for "${query}"`); return null; }

    // Content-aware selection. Each Pexels photo carries an `alt` description and
    // a slug in `url`; we read both so a query like "modern bar steps" can't
    // return a temple. First drop any result whose text hits an `exclude` term,
    // then rank the survivors by how many `prefer` terms they hit — so the most
    // on-topic image wins instead of whatever Pexels happened to rank first.
    const textOf = (p) => `${p.alt || ''} ${p.url || ''}`.toLowerCase();
    if (exclude.length) {
      const kept = photos.filter((p) => !exclude.some((t) => textOf(p).includes(t)));
      // Never empty the pool: an off-term photo still beats no card at all.
      if (kept.length) photos = kept;
      else console.warn(`Pexels: every result for "${query}" hit an exclude term; using unfiltered`);
    }
    if (prefer.length) {
      const score = (p) => prefer.reduce((n, t) => n + (textOf(p).includes(t) ? 1 : 0), 0);
      photos = [...photos].sort((a, b) => score(b) - score(a)); // stable: ties keep Pexels order
    }
    const chosen = photos[pick % photos.length];
    const src = chosen.src?.large2x || chosen.src?.large || chosen.src?.original;
    if (!src) return null;
    const img = await fetch(src);
    if (!img.ok) { console.warn(`Pexels image fetch HTTP ${img.status}`); return null; }
    const buf = Buffer.from(await img.arrayBuffer());
    const mime = img.headers.get('content-type') || 'image/jpeg';
    return {
      b64: buf.toString('base64'),
      mime,
      photographer: chosen.photographer || '',
      url: chosen.url || '',
    };
  } catch (e) {
    console.warn(`Pexels fetch failed for "${query}": ${e.message.slice(0, 120)}`);
    return null;
  }
}
