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
  {
    id: 'ons-lonely-14',
    eyebrow: 'Nearly four times as lonely',
    stat: '13.9%',
    claim: 'of disabled people feel lonely often or always, against 3.8% of non-disabled people.',
    context: 'Almost four times the rate.',
    source: 'Source: ONS, Outcomes for Disabled People in the UK, 2020 (data to March 2019)',
  },
  {
    id: 'sense-chronic-61',
    eyebrow: 'Loneliness is the rule, not the exception',
    stat: '61%',
    claim: 'of disabled people are chronically lonely.',
    context: 'It climbs to 70% of disabled 16 to 24 year olds.',
    source: 'Source: Sense (UK)',
  },
  {
    id: 'sense-complex-53',
    eyebrow: 'Double the loneliness',
    stat: '53%',
    claim: 'of people with complex disabilities feel lonely, against 25% of the general population.',
    context: 'More than twice as likely.',
    source: 'Source: Sense, 2023 (UK)',
  },
  {
    id: 'abbott-attractive-32',
    eyebrow: 'Written off on sight',
    stat: '32%',
    claim: 'of Brits see people with a health condition as less attractive.',
    context: 'Nearly a third. Before a single word is exchanged.',
    source: 'Source: Abbott, Discrimidating survey (UK)',
  },
  // More real, sourced stats go here as they are verified. Candidates worth
  // sourcing properly (Scope, ONS, Sense, Leonard Cheshire publish these):
  // share of people who would not date a disabled person, dating-app
  // accessibility gaps. Do NOT add until the exact figure and source are
  // confirmed. Pending firmer primary-source confirmation: a Tinder survey of
  // 18 to 25 year olds reportedly found only ~50% would consider dating someone
  // disabled or neurodivergent (seen via Scope; confirm before adding).
];

export function statById(id) {
  return STATS_POOL.find((s) => s.id === id) || null;
}

export function hasStats() {
  return STATS_POOL.length > 0;
}
