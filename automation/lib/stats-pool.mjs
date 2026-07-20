// Curated, REAL, sourced statistics for the "stat + my take" cards.
//
// HARD RULE: nothing in here is invented, ever. Every entry must carry a genuine,
// citable source. The content brain may ONLY build a stat card from this pool; it
// is never allowed to make up a number. A stat card is only produced on a given
// day if the pool has an entry, so an empty-ish pool simply means fewer stat
// cards, never a fabricated one.
//
// To add a stat: paste the real figure, the plain claim, and the exact source.
// When in doubt, leave it out. One bad number can burn a young app's trust.

export const STATS_POOL = [
  {
    id: 'disclosure-58',
    eyebrow: 'The disclosure dread is real',
    stat: '58%',
    claim: 'of dating-app users with a health condition won\'t disclose it.',
    context: '26% fear being stigmatised, 25% fear discrimination.',
    source: 'Source: Abbott, "Discrimidating" survey (UK)',
  },
  {
    id: 'scope-asked-5',
    eyebrow: 'The numbers are grim',
    stat: '5%',
    claim: 'of non-disabled Brits have ever asked a disabled person on a date.',
    context: 'Not five in ten. Five in a hundred.',
    source: 'Source: Scope, "Current attitudes towards disabled people" (UK, 2014)',
  },
  {
    id: 'scope-awkward-67',
    eyebrow: 'Awkward is a choice',
    stat: '67%',
    claim: 'of Brits say they feel awkward around disabled people.',
    context: 'Awkwardness is why so many never even say hello.',
    source: 'Source: Scope, "End the Awkward" research (UK, 2014)',
  },
  // More real, sourced stats go here as they are verified. Candidates worth
  // sourcing properly (Scope, ONS, Sense, Leonard Cheshire publish these):
  // disabled-adult loneliness rates, share of people who would not date a
  // disabled person, dating-app accessibility gaps. Do NOT add until the exact
  // figure and source are confirmed.
];

export function statById(id) {
  return STATS_POOL.find((s) => s.id === id) || null;
}

export function hasStats() {
  return STATS_POOL.length > 0;
}
