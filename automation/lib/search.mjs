// Live web search for the outreach scout, the FREE way.
//
// Tavily gives 1,000 searches/month free with no card. One brief a day uses a
// handful, nowhere near the limit. Get a key at https://app.tavily.com (sign
// in, no card) and save it as the TAVILY_API_KEY repo secret.

export function hasTavily() {
  return !!process.env.TAVILY_API_KEY;
}

export async function tavilySearch(query, { days = 4, maxResults = 3, topic = 'news', includeDomains } = {}) {
  const key = process.env.TAVILY_API_KEY;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      topic,
      days,
      max_results: maxResults,
      ...(includeDomains ? { include_domains: includeDomains } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    content: (r.content || '').replace(/\s+/g, ' ').slice(0, 320),
  }));
}

// Queries the scout sweeps each morning. UK-weighted, global-aware.
// The nightlife/venue-exclusion theme is deliberately prominent: it is the
// founder's core argument and his home turf (Manchester, Canal Street).
const QUERIES = [
  'disability and dating',
  'dating app accessibility disabled people',
  'interabled couple relationship',
  'chronic illness dating',
  'disabled dating UK',
  'disability pride relationships',
  'nightclub wheelchair accessibility UK',
  'Manchester Canal Street Gay Village events',
  'music venue accessibility disabled UK',
  'listed building disabled access refused UK',
];

// Hard tragedy filter. Replying to a death, disaster or grief story to plug a
// dating app reads as opportunistic, so these items never even reach the model.
// The word-boundary match keeps it from tripping on innocent substrings.
const TRAGEDY = new RegExp(
  '\\b(' + [
    'dead', 'death', 'dies', 'died', 'dying', 'killed', 'killing', 'kills',
    'fatal', 'fatalities', 'deadly', 'murder', 'murdered', 'homicide', 'stabbed',
    'shooting', 'shot dead', 'gunman', 'massacre', 'terror', 'terrorist',
    'suicide', 'self-harm', 'overdose', 'fire', 'blaze', 'wildfire', 'explosion',
    'crash', 'crashed', 'collision', 'derailed', 'drowned', 'earthquake',
    'flood', 'hurricane', 'disaster', 'tragedy', 'tragic', 'grief', 'grieving',
    'bereaved', 'bereavement', 'funeral', 'mourning', 'obituary', 'condolences',
    'coroner', 'inquest', 'manslaughter', 'assault', 'abuse', 'raped', 'rape',
  ].join('|') + ')\\b',
  'i',
);

function isTragedy(item) {
  return TRAGEDY.test(`${item.title || ''} ${item.content || ''}`);
}

// Find REAL posts on X to reply to. Tavily searches the indexed web scoped to
// x.com/twitter.com; a status URL carries the tweet id, which is what the X API
// needs to post a reply. Coverage of X's index varies day to day, so callers
// must treat this as best-effort and log the count.
const X_QUERIES = [
  'disability dating', 'dating with a disability', 'disabled dating apps',
  'wheelchair accessible venue', 'accessible nightlife', 'chronic illness dating',
  'disability pride dating', 'accessible date night',
];

export async function findTweets() {
  const found = [];
  for (const q of X_QUERIES) {
    try {
      found.push(...(await tavilySearch(q, {
        topic: 'general', days: 7, maxResults: 5,
        includeDomains: ['x.com', 'twitter.com'],
      })));
    } catch (e) {
      console.warn(`tweet search "${q}" failed: ${e.message.slice(0, 100)}`);
    }
  }
  const seen = new Set();
  const tweets = [];
  for (const f of found) {
    const m = (f.url || '').match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/);
    if (!m) continue;
    const [, author, id] = m;
    if (seen.has(id) || author.toLowerCase() === 'able2loveapp') continue;
    seen.add(id);
    tweets.push({ id, author, url: `https://x.com/${author}/status/${id}`, text: `${f.title || ''} ${f.content || ''}`.replace(/\s+/g, ' ').trim().slice(0, 400) });
  }
  return tweets.filter((t) => !isTragedy({ title: t.text, content: '' }));
}

// Gather fresh, REAL items (deduped, tragedy stripped). One query failing never
// sinks the run.
export async function gatherLiveItems(target) {
  const items = [];
  for (const q of QUERIES) {
    try {
      items.push(...(await tavilySearch(q, { topic: 'news', days: 4, maxResults: 3 })));
    } catch (e) {
      console.warn(`search "${q}" failed: ${e.message.slice(0, 120)}`);
    }
  }
  // The outreach target of the day, searched by name.
  try {
    const name = target.split('(')[0].trim();
    items.push(...(await tavilySearch(name, { topic: 'general', days: 21, maxResults: 2 })));
  } catch (e) {
    console.warn(`target search failed: ${e.message.slice(0, 120)}`);
  }
  const seen = new Set();
  const deduped = items.filter((i) => i.url && !seen.has(i.url) && seen.add(i.url));
  const safe = deduped.filter((i) => !isTragedy(i));
  const dropped = deduped.length - safe.length;
  if (dropped) console.log(`Tragedy filter dropped ${dropped} item(s) before drafting.`);
  return safe;
}
