// Live web search for the outreach scout, the FREE way.
//
// Tavily gives 1,000 searches/month free with no card. One brief a day uses a
// handful, nowhere near the limit. Get a key at https://app.tavily.com (sign
// in, no card) and save it as the TAVILY_API_KEY repo secret.

export function hasTavily() {
  return !!process.env.TAVILY_API_KEY;
}

// Brave Search API gives 2,000 queries/month free with no card. Get a key at
// https://api.search.brave.com (create a free "Data for Search" subscription,
// no card asked) and save it as the BRAVE_API_KEY repo secret. It is the
// reliable, high-quota provider and its index of x.com and instagram.com is
// dense (Bing-class), which is exactly where Tavily is thin. When this key
// exists the daily sweep widens and Brave carries it; Tavily is then spared
// entirely for the news pass.
export function hasBrave() {
  return !!process.env.BRAVE_API_KEY;
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

// Brave Search API. Domain scoping is done with the site: operator in the query
// (Brave has no include_domains param). Freshness maps our day/week/month/year
// to Brave's pd/pw/pm/py. Returns the same {title,url,content} shape as Tavily.
async function braveSearch(query, { maxResults = 10, includeDomains, timeRange } = {}) {
  const key = process.env.BRAVE_API_KEY;
  const q = includeDomains && includeDomains.length
    ? `${query} (${includeDomains.map((d) => 'site:' + d).join(' OR ')})`
    : query;
  const params = new URLSearchParams({
    q,
    count: String(Math.min(Math.max(maxResults, 1), 20)),
    country: 'GB',
    search_lang: 'en',
    safesearch: 'off',
    text_decorations: 'false',
    spellcheck: 'false',
  });
  const fresh = { day: 'pd', week: 'pw', month: 'pm', year: 'py' }[timeRange];
  if (fresh) params.set('freshness', fresh);
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': key,
    },
  });
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  const results = (data.web && data.web.results) || [];
  return results.map((r) => ({
    title: r.title || '',
    url: r.url || '',
    content: String(r.description || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .slice(0, 320),
  }));
}

// DuckDuckGo's HTML endpoint: no key, no monthly cap, but fragile. It soft-blocks
// a busy IP with an HTTP 202 and a challenge page instead of results, and a
// datacenter IP (a CI runner) is blocked sooner than a home one. So it is
// best-effort only: on a 202 it returns this sentinel and webSearch rests it for
// the remainder of the run. Real result links arrive wrapped as
// //duckduckgo.com/l/?uddg=<urlencoded target>; ad rows point back at
// duckduckgo.com and are dropped.
const DDG_BLOCKED = Symbol('ddg-blocked');

async function ddgSearch(query, { includeDomains, maxResults = 12 } = {}) {
  const q = includeDomains && includeDomains.length
    ? `${query} ${includeDomains.map((d) => 'site:' + d).join(' OR ')}`
    : query;
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
      Referer: 'https://html.duckduckgo.com/',
    },
    body: new URLSearchParams({ q, kl: 'uk-en' }).toString(),
  });
  // 202 (and 403/429) is DuckDuckGo's soft block, not a result page.
  if (res.status === 202 || res.status === 403 || res.status === 429) return DDG_BLOCKED;
  if (!res.ok) throw new Error(`DDG HTTP ${res.status}`);
  const html = await res.text();

  // Pair each result link with the snippet that follows it, by string position,
  // so previews line up with URLs even when ad rows are dropped.
  const unwrap = (href) => {
    const m = href.match(/uddg=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : href;
  };
  const links = [];
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gs;
  let m;
  while ((m = linkRe.exec(html))) {
    const url = unwrap(m[1]);
    if (/duckduckgo\.com/i.test(url)) continue; // ad row or unresolved redirect
    links.push({ at: m.index, url, title: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
  }
  const snips = [];
  const snipRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/gs;
  while ((m = snipRe.exec(html))) {
    snips.push({ at: m.index, text: m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
  }
  return links.slice(0, maxResults).map((l) => {
    const s = snips.find((sn) => sn.at > l.at);
    return { title: l.title, url: l.url, content: (s ? s.text : '').slice(0, 320) };
  });
}

// Per-run scratchpad. A provider that has hit its monthly wall or been soft
// blocked is rested for the rest of THIS brief rather than retried on all ~40
// queries. ddgLast keeps DuckDuckGo calls politely spaced.
const runState = { tavilyDown: false, braveDown: false, ddgDown: false, ddgLast: 0 };

// One search entry point for the whole scout, free by design. Providers are
// tried in order of reliable quota, and once we have enough hits we stop, so a
// good provider is never topped up for no reason:
//   Brave (2,000/month, dense index)  ->  Tavily (1,000/month, thin on x/IG)
//   ->  DuckDuckGo (no cap, fragile).
// Brave and Tavily are the two KEYED discovery providers and are mutually
// exclusive here: when a Brave key exists Tavily is left completely alone so its
// budget stays whole for the news pass, and only if Brave is absent or spent
// does Tavily take the discovery load. DuckDuckGo tops up either of them, for
// free, until the IP is blocked. Results are merged and deduped by URL.
export async function webSearch(query, {
  maxResults = 10, includeDomains, timeRange = 'month', topic,
} = {}) {
  const results = [];
  const seen = new Set();
  const add = (arr) => {
    for (const r of arr || []) {
      const key = String(r.url || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); results.push(r); }
    }
  };
  const enough = () => results.length >= maxResults;

  let braveContributed = false;
  if (hasBrave() && !runState.braveDown) {
    try {
      const before = results.length;
      add(await braveSearch(query, { maxResults, includeDomains, timeRange }));
      braveContributed = results.length > before;
    } catch (e) {
      if (/\b(429|402|403)\b/.test(e.message)) { runState.braveDown = true; console.warn('Brave hit its wall, resting it for the rest of the run.'); }
      else console.warn(`Brave "${query.slice(0, 40)}": ${e.message.slice(0, 80)}`);
    }
  }

  // Tavily steps in when there is no Brave key to spare, when Brave is spent, OR
  // when Brave returned nothing usable for this particular query (an error or an
  // empty index corner): better to spend one Tavily call than to hand back an
  // empty result and rely on DuckDuckGo, which is blocked on CI runners.
  const tavilyForDiscovery = !hasBrave() || runState.braveDown || !braveContributed;
  if (!enough() && tavilyForDiscovery && hasTavily() && !runState.tavilyDown) {
    try {
      add(await tavilySearch(query, { topic: topic || 'general', timeRange, maxResults, includeDomains }));
    } catch (e) {
      if (/\b(429|432|433)\b/.test(e.message)) { runState.tavilyDown = true; console.warn('Tavily hit its monthly wall, resting it for the rest of the run.'); }
      else console.warn(`Tavily "${query.slice(0, 40)}": ${e.message.slice(0, 80)}`);
    }
  }

  if (!enough() && !runState.ddgDown) {
    try {
      const gap = 1500 - (Date.now() - runState.ddgLast);
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      runState.ddgLast = Date.now();
      const r = await ddgSearch(query, { includeDomains, maxResults });
      if (r === DDG_BLOCKED) { runState.ddgDown = true; console.warn('DuckDuckGo soft-blocked this IP (202), resting it for the rest of the run.'); }
      else add(r);
    } catch (e) {
      console.warn(`DuckDuckGo "${query.slice(0, 40)}": ${e.message.slice(0, 80)}`);
    }
  }

  return results;
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

// THE BUDGET, and how it decides the sweep size. Brave's free tier is $5 of
// credit a month, which is exactly 1,000 requests ($5 per 1,000), so the whole
// month has to fit under 1,000 Brave calls to stay genuinely free. Brave is
// called once per query and returns up to 20 results a call, so volume comes
// from asking richer queries, NOT more of them: with the Brave key on, the
// sweep is 15 X + 12 Instagram + 1 target = 28 calls a day (~868 in a 31-day
// month, comfortably under the free 1,000) and each of those pulls up to 20
// posts, which is plenty to fill a 20 + 20 brief after de-duping. News stays on
// Tavily and costs no Brave calls.
//
// Without a Brave key the sweep stays small so Tavily's own 1,000/month is
// never blown, and DuckDuckGo tops it up for free while its IP holds.
function sweepSizes() {
  return hasBrave()
    ? { gmX: 6, ukX: 7, abX: 2, gmI: 5, ukI: 5, abI: 2 }
    : { gmX: 6, ukX: 8, abX: 3, gmI: 3, ukI: 3, abI: 2 };
}

function todaysQueries() {
  const s = sweepSizes();
  return [
    ...rotate(GM_QUERIES, s.gmX, 0).map((q) => ({ q, tier: 3 })),
    ...rotate(UK_QUERIES, s.ukX, 3).map((q) => ({ q, tier: 2 })),
    ...rotate(ABROAD_QUERIES, s.abX, 1).map((a) => ({ q: a.q, tier: 1, country: a.country })),
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
      const hits = await webSearch(q, {
        // time_range:'month' bounds recency for the providers that honour it.
        // maxResults 20 is Brave's per-request maximum, and one Brave request
        // costs the same whether it returns 1 result or 20, so we take the lot.
        timeRange: 'month', maxResults: 20,
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
  const s = sweepSizes();
  return [
    ...rotate(GM_QUERIES, s.gmI, 2).map((q) => ({ q, tier: 3 })),
    ...rotate(UK_QUERIES, s.ukI, 5).map((q) => ({ q, tier: 2 })),
    ...rotate(ABROAD_QUERIES, s.abI, 2).map((a) => ({ q: a.q, tier: 1, country: a.country })),
  ];
}

export async function findInstagramPosts() {
  const found = [];
  for (const spec of todaysIgQueries()) {
    try {
      const hits = await webSearch(spec.q, {
        timeRange: 'month', maxResults: 20,
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
  // News stays on Tavily: recent-news is its strength and this is only a
  // handful of calls a day, well inside its budget even alongside a wide Brave
  // sweep. If there is no Tavily key the news ammo is simply skipped.
  if (hasTavily() && !runState.tavilyDown) {
    for (const q of rotate(QUERIES, 7, 0)) {
      try {
        items.push(...(await tavilySearch(q, { topic: 'news', days: 4, maxResults: 3 })));
      } catch (e) {
        console.warn(`search "${q}" failed: ${e.message.slice(0, 120)}`);
      }
    }
  }
  // The outreach target of the day, searched by name, through the free chain.
  try {
    const name = target.split('(')[0].trim();
    items.push(...(await webSearch(name, { topic: 'general', timeRange: 'week', maxResults: 3 })));
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
