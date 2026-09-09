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
// A much wider net, because the rule "only show posts we can place" is only
// workable if there are enough placed posts to choose from. One card a day is
// not outreach. So: every Greater Manchester town, a long list of British
// cities, the vocabulary that only British disabled people use (PIP, Blue
// Badge, Motability, the NHS), and the allies as well as the disabled.
//
// Tavily's free tier is 1,000 searches a month, so running all of these every
// day would blow it. Instead the Manchester core runs every single day and the
// rest ROTATE, a different slice each day, which also stops the brief showing
// the same faces over and over.
const GM_QUERIES = [
  'disabled Manchester', 'wheelchair Manchester', 'accessible Manchester',
  'disabled Salford', 'disability Greater Manchester', 'accessible night out Manchester',
  'disabled Stockport', 'disabled Oldham', 'disabled Bolton', 'wheelchair Bury Manchester',
  'disabled Rochdale', 'accessible Trafford', 'disabled Wigan', 'disabled Tameside',
  'Manchester wheelchair access', 'Manchester disability community',
];

const UK_QUERIES = [
  'disability dating UK', 'dating with a disability UK', 'disabled dating app UK',
  'wheelchair user UK dating', 'chronic illness dating UK', 'disabled and single UK',
  'accessible date night UK', 'wheelchair accessible pub UK', 'disability pride UK',
  'neurodivergent dating UK', 'invisible illness UK', 'spoonie UK',
  'disabled London dating', 'disabled Birmingham', 'disabled Leeds', 'disabled Liverpool',
  'disabled Glasgow', 'disabled Bristol', 'disabled Sheffield', 'disabled Newcastle',
  'disabled Nottingham', 'disabled Cardiff', 'disabled Edinburgh', 'disabled Brighton',
  // Vocabulary that is British on its own, no place name needed.
  'PIP assessment disabled', 'Blue Badge parking', 'Motability car', 'NHS wheelchair waiting',
  'access needs UK venue', 'step free access UK', 'disabled students UK',
  // Allies and partners, not only disabled people.
  'interabled couple UK', 'dating someone disabled UK', 'my disabled partner UK',
  'disability ally UK', 'carer partner UK',
];

const ABROAD_QUERIES = [
  { q: 'disability dating USA', country: 'US' },
  { q: 'disabled dating America', country: 'US' },
  { q: 'wheelchair user dating US', country: 'US' },
  { q: 'interabled couple', country: 'US' },
  { q: 'disabled and single America', country: 'US' },
  { q: 'disability dating Australia', country: 'AU' },
  { q: 'NDIS dating disabled', country: 'AU' },
  { q: 'disabled dating Ireland', country: 'IE' },
  { q: 'disability dating Canada', country: 'CA' },
  { q: 'disabled dating New Zealand', country: 'NZ' },
];

// Which slice runs today. Rotating by day means a fortnight covers everything
// without ever spending more searches than a single day's budget.
function rotate(list, take, offset) {
  const day = Math.floor(Date.now() / 86400000);
  const out = [];
  for (let i = 0; i < Math.min(take, list.length); i++) {
    out.push(list[(day * take + i + offset) % list.length]);
  }
  return out;
}

function todaysQueries() {
  return [
    ...rotate(GM_QUERIES, 8, 0).map((q) => ({ q, tier: 3 })),
    ...rotate(UK_QUERIES, 14, 3).map((q) => ({ q, tier: 2 })),
    ...rotate(ABROAD_QUERIES, 5, 1).map((a) => ({ q: a.q, tier: 1, country: a.country })),
  ];
}

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

// Where the app actually has people, from Play's own country split over the
// 28 days to 8 Sep 2026: United States ~35 to 39%, United Kingdom ~20 to 23%,
// Australia ~4 to 6%, Switzerland ~2%, the rest spread thin. The 20% of the
// sweep that is not British is spent in that order rather than at random, so
// the second biggest market gets the most of it.
const REACH_ORDER = [
  { code: 'US', re: /\busa\b|\bu\.s\.|america|american|\bnyc\b|texas|california|florida|chicago|\bada\b|medicaid|medicare|\bssdi\b/i },
  { code: 'AU', re: /australia|australian|aussie|sydney|melbourne|brisbane|\bndis\b/i },
  { code: 'CH', re: /switzerland|swiss|zurich|geneva|basel/i },
  { code: 'IE', re: /ireland|irish|dublin|cork|belfast/i },
  { code: 'CA', re: /canada|canadian|toronto|vancouver|ontario/i },
  { code: 'NZ', re: /new zealand|\bnz\b|auckland/i },
];

// Which of those a post reads as, or null.
export function reachCountry(text = '') {
  const t = String(text);
  for (const r of REACH_ORDER) if (r.re.test(t)) return r.code;
  return null;
}

export function ukScore(text = '') {
  const t = String(text);
  if (GM.test(t)) return 3;
  if (UK.test(t)) return 2;
  if (reachCountry(t)) return 1;
  return 0;
}

export function placeLabel(score, code, confirmed) {
  const where = score >= 3 ? 'Greater Manchester'
    : score === 2 ? 'UK'
    : score === 1 ? (code ? 'Outside the UK: ' + code : 'Outside the UK')
    : 'Location not clear';
  if (score === 0) return where;
  // Never state a place as fact when only the search implied it.
  return confirmed ? where + ' (confirmed)' : 'Likely ' + where;
}

// Build the day's list at roughly 70% British, 30% everywhere else, with that
// 30% spent in order of where the app is actually biggest. 70 not 80 because
// Britain is only 20-23% of the audience against America's 35-39%, and because
// British supply on these topics is thin enough that 80 could rarely be met. Falls back rather
// than starves: if Britain cannot fill its share the rest of the world takes
// up the slack, and the other way round.
export function blendByReach(items, want, britishShare = 0.7, allowUnplaced = false) {
  const british = items.filter((i) => i.uk >= 2);
  const abroad = items.filter((i) => i.uk === 1);
  // Unplaced means we do not actually know where this person is. Showing those
  // makes the 70/30 split meaningless, so by default they never reach the
  // dashboard at all, not even as filler on a thin day.
  const unplaced = allowUnplaced ? items.filter((i) => i.uk === 0) : [];

  // Abroad is ordered by the reach list, so the US is spent before Australia.
  const rank = (c) => { const n = REACH_ORDER.findIndex((r) => r.code === c); return n < 0 ? 99 : n; };
  abroad.sort((a, b) => rank(a.country) - rank(b.country));

  const wantBritish = Math.round(want * britishShare);
  const out = [...british.slice(0, wantBritish), ...abroad.slice(0, want - wantBritish)];

  // Top up from the other placed pools. A short day is better than a day full
  // of people we cannot place.
  for (const pool of [british.slice(wantBritish), abroad.slice(want - wantBritish), unplaced]) {
    for (const item of pool) { if (out.length >= want) break; out.push(item); }
  }
  return out.slice(0, want);
}

// Tavily returns a short `title` (often just the first slice of the post) plus a
// longer `content` excerpt that overlaps it. Naive `title + content` therefore
// reads as the same words twice with an ellipsis in the join. Prefer the fuller
// field and strip the "Name on X:" lead-in, so the preview reads as one clean
// quote instead of a stutter.
function tweetText(f) {
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  let title = clean(f.title).replace(/^.*?\bon (?:X|Twitter):\s*/i, '');
  const content = clean(f.content);
  let text = content.length >= title.length ? content : title;
  if (!text) text = title || content;
  return text.replace(/^["'\s]+/, '').slice(0, 400).trim();
}

// Searching "accessible Manchester venue" also returns Manchester United, gig
// listings and ticket touts, and the placing regex happily tags all of it
// Greater Manchester. So a post must ALSO be about the actual subject before
// it can reach the follow list. Being local is not a reason to follow someone.
const ON_TOPIC = new RegExp('(' + [
  'disab', 'disabil', 'wheelchair', 'wheelie', 'accessib', 'inaccessib',
  'crutch', 'mobility aid', 'walking stick', 'white cane', 'guide dog',
  'deaf', 'blind', 'autis', '\\badhd\\b', 'neurodiver', 'chronic illness', 'chronically ill',
  'spoonie', 'invisible illness', 'ableis', 'ableist', 'carer', 'care needs',
  '\\bpip\\b', 'motability', 'blue badge', 'step free', 'stepfree', 'ramp',
  'dating', 'relationship', 'romance', 'boyfriend', 'girlfriend', 'first date', 'a date with',
  'tinder', 'hinge', 'bumble', 'ghosted', 'ghosting',
].join('|') + ')', 'i');

// Obvious noise that sails through on a place name alone.
const OFF_TOPIC = new RegExp('(' + [
  'man utd', 'manutd', '\\bmufc\\b', 'man city', '\\bmcfc\\b', 'premier league',
  'transfer news', 'kick off', 'full time', 'fixture', 'match report',
  'tickets on sale', 'tour dates', 'gig guide', 'support act', 'doors open',
  'betting', 'odds', 'casino', 'crypto', 'giveaway',
  'equities', 'stocks', 'shares', 'trading', 'investor', 'portfolio', 'nasdaq',
].join('|') + ')', 'i');

export function isRelevant(text = '') {
  const t = String(text);
  if (OFF_TOPIC.test(t)) return false;
  return ON_TOPIC.test(t);
}

export async function findTweets() {
  const found = [];
  const specs = todaysQueries();
  console.log(`Sweeping ${specs.length} location-specific searches today.`);
  for (const spec of specs) {
    const q = spec.q;
    try {
      const hits = await tavilySearch(q, {
        // time_range:'week' is what actually enforces "no post older than a
        // week" here; days is ignored for topic:'general'.
        topic: 'general', timeRange: 'month', maxResults: 10,
        includeDomains: ['x.com', 'twitter.com'],
      });
      // The search that found it IS its location, which is far more reliable
      // than hunting for a place name in the post itself.
      hits.forEach((h) => { h.fromTier = spec.tier; h.fromCountry = spec.country || null; h.fromQuery = q; });
      found.push(...hits);
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
    const byText = ukScore(text);
    const uk = Math.max(byText, f.fromTier || 0);
    tweets.push({
      id, author, url: `https://x.com/${author}/status/${id}`, text, uk,
      country: reachCountry(text) || f.fromCountry || null,
      // The post's own words placed it, rather than the search we happened
      // to find it through.
      confirmed: byText > 0,
      matchedQuery: f.fromQuery || '',
    });
  }
  const notTragedy = tweets.filter((t) => !isTragedy({ title: t.text, content: '' }));
  const kept = notTragedy.filter((t) => isRelevant(t.text));
  const offTopic = notTragedy.length - kept.length;
  if (offTopic) console.log(`Dropped ${offTopic} post(s) that matched a place but were not about disability, access or dating.`);
  // Greater Manchester first, then anything else that reads British, then the
  // rest. Nothing is discarded for being foreign, it just sorts lower.
  kept.sort((a, b) => b.uk - a.uk);
  const n = (v) => kept.filter((t) => t.uk === v).length;
  console.log(`Tweets found: ${kept.length} (${n(3)} Greater Manchester, ${n(2)} rest of UK, ${n(1)} abroad, ${n(0)} unplaced).`);
  return kept;
}

// Gather fresh, REAL items (deduped, tragedy stripped). One query failing never
// sinks the run.
// Instagram, found the same way as X. Until now the hit-list was a list of
// posts to go and LOOK for, written by the model, so "Open on Instagram" had
// nothing to open and dumped you on the explore page. These are real posts
// with real links, so a comment can be drafted against what someone actually
// said.
function todaysIgQueries() {
  return [
    ...rotate(GM_QUERIES, 4, 2).map((q) => ({ q, tier: 3 })),
    ...rotate(UK_QUERIES, 8, 5).map((q) => ({ q, tier: 2 })),
    ...rotate(ABROAD_QUERIES, 3, 2).map((a) => ({ q: a.q, tier: 1, country: a.country })),
  ];
}

export async function findInstagramPosts() {
  const found = [];
  for (const spec of todaysIgQueries()) {
    try {
      const hits = await tavilySearch(spec.q, {
        topic: 'general', timeRange: 'month', maxResults: 6,
        includeDomains: ['instagram.com'],
      });
      hits.forEach((h) => { h.fromTier = spec.tier; h.fromCountry = spec.country || null; });
      found.push(...hits);
    } catch (e) {
      console.warn(`instagram search "${spec.q}" failed: ${e.message.slice(0, 100)}`);
    }
  }
  const seen = new Set();
  const posts = [];
  for (const f of found) {
    // Only real posts and reels, never profile or explore pages.
    const m = (f.url || '').match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel)\/([A-Za-z0-9_-]+)/);
    if (!m) continue;
    const [, kind, code] = m;
    if (seen.has(code)) continue;
    seen.add(code);
    const text = tweetText(f);
    // Instagram surfaces the place a post was tagged with. If the tag names
    // somewhere British, that is a location the person chose themselves and is
    // better evidence than anything in the caption.
    const geo = `${f.title || ''} ${f.content || ''} ${f.url || ''}`;
    const byText = Math.max(ukScore(text), ukScore(geo));
    posts.push({
      code, kind, confirmed: byText > 0, matchedQuery: spec.q,
      url: `https://www.instagram.com/${kind}/${code}/`,
      text,
      uk: Math.max(byText, f.fromTier || 0),
      country: reachCountry(text) || f.fromCountry || null,
    });
  }
  const kept = posts.filter((x) => !isTragedy({ title: x.text, content: '' }) && isRelevant(x.text));
  console.log(`Instagram posts found: ${kept.length} real post(s) of ${posts.length} matched.`);
  return kept;
}

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
