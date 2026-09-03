// Live web search for the outreach scout, the FREE way.
//
// Tavily gives 1,000 searches/month free with no card. One brief a day uses a
// handful, nowhere near the limit. Get a key at https://app.tavily.com (sign
// in, no card) and save it as the TAVILY_API_KEY repo secret.

export function hasTavily() {
  return !!process.env.TAVILY_API_KEY;
}

export async function tavilySearch(query, { days = 4, maxResults = 3, topic = 'news', includeDomains, timeRange } = {}) {
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
      // For topic:'general' Tavily ignores `days`; only `time_range`
      // (day|week|month|year) bounds recency, so pass it whenever we need "no
      // older than a week" on non-news searches.
      ...(timeRange ? { time_range: timeRange } : {}),
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
  // Greater Manchester first. The app only works at local density, so the
  // brief should surface things happening where he actually is and can turn up.
  'Greater Manchester disability news',
  'Manchester disabled access venue',
  'Salford disability community',
  'Manchester Canal Street Gay Village events',
  'Greater Manchester accessible events disabled people',
  'nightclub wheelchair accessibility UK',
  'listed building disabled access refused UK',
  'music venue accessibility disabled UK',
  // Then the UK-wide themes.
  'disabled dating UK',
  'disability and dating UK',
  'dating app accessibility disabled people UK',
  'chronic illness dating UK',
  'interabled couple relationship UK',
  'disability pride relationships UK',
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
// These carried no geography at all, which is why the brief kept surfacing
// American accounts. He is in Greater Manchester and the app needs local
// density, so the sweep is Manchester first, then UK, then a short generic
// tail so the brief never runs dry on a quiet day.
const X_QUERIES = [
  'disabled Manchester', 'wheelchair Manchester', 'accessible Manchester venue',
  'disability Greater Manchester', 'disabled Salford', 'accessible night out Manchester',
  'disability dating UK', 'dating with a disability UK', 'disabled dating app UK',
  'wheelchair user UK dating', 'chronic illness dating UK', 'spoonie UK',
  'disabled and single UK', 'accessible date night UK', 'inaccessible venue UK',
  'wheelchair accessible pub UK', 'accessible nightlife UK', 'disability pride UK',
  'neurodivergent dating UK', 'dating apps ableism UK', 'invisible illness UK',
  'disability dating', 'dating as a disabled person', 'ghosted disability dating',
];

// Where a post reads as being from. This ORDERS the day's list, it never bins
// anything: Manchester first because the app needs local density and he can
// physically turn up, then the rest of the UK, then Ireland and the other
// English-speaking places where there is already traction. A good post from
// anywhere still beats an empty dashboard.
const GM = /manchester|salford|stockport|oldham|rochdale|bolton|\bbury\b|trafford|tameside|wigan|canal street|northern quarter/i;

const UK = new RegExp('(' + [
  '\\buk\\b', 'britain', 'british', 'england', 'scotland', 'wales',
  'london', 'leeds', 'liverpool', 'birmingham', 'glasgow', 'bristol',
  'sheffield', 'newcastle', 'nottingham', 'brighton', 'cardiff', 'edinburgh',
  '\\bnhs\\b', '\\bpip\\b', 'motability', 'blue badge', 'disability living allowance',
  '\\bmum\\b', 'whilst', 'colour', 'realise', 'organisation', 'apologise',
  '\\.co\\.uk', '\u00a3',
].join('|') + ')', 'i');

// English-speaking elsewhere, including everywhere the app already has users.
const ANGLO = new RegExp('(' + [
  'ireland', 'irish', 'dublin', 'cork', 'belfast',
  '\\busa\\b', '\\bus\\b', 'america', 'american', 'canada', 'canadian',
  'australia', 'australian', 'aussie', 'new zealand', '\\bnz\\b',
  'south africa', 'malta', 'netherlands', 'dutch', 'sweden', 'swedish',
  'norway', 'denmark', 'germany', 'berlin',
  '\\bada\\b', 'medicaid', 'medicare', '\\bssdi\\b', '\\bnyc\\b', 'texas', 'california',
].join('|') + ')', 'i');

// 3 = Greater Manchester, 2 = rest of the UK, 1 = English-speaking elsewhere,
// 0 = nothing to go on. Never a filter, only a sort key.
export function ukScore(text = '') {
  const t = String(text);
  if (GM.test(t)) return 3;
  if (UK.test(t)) return 2;
  if (ANGLO.test(t)) return 1;
  return 0;
}

export function placeLabel(score) {
  return score >= 3 ? 'Greater Manchester'
    : score === 2 ? 'UK'
    : score === 1 ? 'English speaking, outside the UK'
    : 'Location not clear';
}

export async function findTweets() {
  const found = [];
  for (const q of X_QUERIES) {
    try {
      found.push(...(await tavilySearch(q, {
        // time_range:'week' is what actually enforces "no post older than a
        // week" here; days is ignored for topic:'general'.
        topic: 'general', timeRange: 'week', maxResults: 6,
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
    const text = tweetText(f);
    tweets.push({ id, author, url: `https://x.com/${author}/status/${id}`, text, uk: ukScore(text) });
  }
  const kept = tweets.filter((t) => !isTragedy({ title: t.text, content: '' }));
  // Greater Manchester first, then anything else that reads British, then the
  // rest. Nothing is discarded for being foreign, it just sorts lower.
  kept.sort((a, b) => b.uk - a.uk);
  const n = (v) => kept.filter((t) => t.uk === v).length;
  console.log(`Tweets found: ${kept.length} (${n(3)} Greater Manchester, ${n(2)} rest of UK, ${n(1)} English speaking elsewhere, ${n(0)} unplaced).`);
  return kept;
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
    items.push(...(await tavilySearch(name, { topic: 'general', timeRange: 'week', maxResults: 2 })));
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
