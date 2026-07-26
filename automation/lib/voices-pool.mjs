// Anonymised, rephrased real voices from disabled daters.
//
// SOURCE: three public Reddit threads on disabled dating (r/disability, r/CMT,
// r/CharcotMarieTooth), gathered 23 July 2026 and written up in
// Documents/Able2Love-Reddit-Insights.md.
//
// HARD SAFETY RULES (do not weaken):
//   1. NO usernames, NO handles, NO identifying detail. Attribution is always a
//      generic descriptor ("A wheelchair user", "A disabled man in his 30s").
//   2. These are REPHRASED composites of what real people expressed, not
//      word-for-word quotes. They carry the emotional truth, not the exact words.
//   3. NEVER present a voice as a statistic or a percentage. A feeling is not data.
//   4. NEVER imply any of these people use Able2Love. They are describing dating
//      in general, before this app existed.
//   5. Public use is framed honestly as "real experiences disabled people shared
//      about dating" — never as app reviews or invented testimonials.
//
// `use`: 'testimonial' = strong enough to stand as a landing/quote card;
//        'social'      = an angle/emotional core for an X or Instagram caption.
// `sensitive`: true = only ever used with a safety/supportive frame, never as shock.

export const VOICES_POOL = [
  // Theme: is it the disability, or me?
  { id: 'itwasnt-you', theme: 'is-it-you', who: 'A wheelchair user', use: 'testimonial',
    voice: "For years I couldn't work out if it was the disability or just me. It was neither. It was other people deciding who I was before I'd said a word." },
  { id: 'luck-not-blame', theme: 'is-it-you', who: 'A disabled man', use: 'social',
    voice: "Finding someone doesn't mean you did it right, and not finding someone doesn't mean you did it wrong. It's mostly luck and timing. Nobody tells you that." },

  // Theme: self-esteem is the real barrier
  { id: 'too-much-to-ask', theme: 'self-esteem', who: 'A disabled man, now married', use: 'testimonial',
    voice: "The thing that nearly stopped me wasn't my body. It was being convinced I was too much to ask anyone to take on." },
  { id: 'my-own-head', theme: 'self-esteem', who: 'A disabled man in his 40s', use: 'social',
    voice: "I spent my twenties assuming I was a dealbreaker, so I barely tried. The disability was never the problem. My own head was." },

  // Theme: apps fail, real life works
  { id: 'away-from-apps', theme: 'apps-fail', who: 'A disabled man', use: 'social',
    voice: "Every good thing happened away from the apps. Through a hobby, through friends, through people who already knew I was more than a diagnosis." },
  { id: 'chair-seen-first', theme: 'apps-fail', who: 'A wheelchair user', use: 'social',
    voice: "The cold apps are rough for everyone, and worse when the first thing they see is the chair instead of you." },

  // Theme: the disclosure dilemma
  { id: 'the-silence-after', theme: 'disclosure', who: 'Someone with an invisible illness', use: 'testimonial',
    voice: "The worst part isn't telling someone. It's the silence right after, while you wait to find out if that was the end of it." },
  { id: 'no-choice-when', theme: 'disclosure', who: 'A wheelchair user', use: 'social',
    voice: "A visible disability takes away your choice of when to say anything. It's decided for you the second they look up." },

  // Theme: seen as a burden or a utility
  { id: 'useful-or-invisible', theme: 'burden', who: 'A disabled man', use: 'social',
    voice: "As a disabled man you stop being seen as a date at all. You're either useful or you're invisible." },
  { id: 'hard-work-verdict', theme: 'burden', who: 'A disabled dater', use: 'social',
    voice: "People want easy now. You can feel them deciding whether you'd be hard work before they've even asked your name." },

  // Theme: novelty, fetishisation, safety (SENSITIVE — safety frame only)
  { id: 'safety-is-everything', theme: 'safety', who: 'A disabled woman', use: 'social', sensitive: true,
    voice: "I've had men get a bit too interested in the idea that I might need help. That's when I block them. For disabled women, safety isn't a nice-to-have, it's the whole thing." },
  { id: 'not-a-good-deed', theme: 'safety', who: 'A disabled dater', use: 'testimonial', sensitive: true,
    voice: "I just want to be a person. Not someone's curiosity, and not someone's good deed." },

  // Theme: the situationship / ghosting wound (Brogan's own core pain)
  { id: 'stayed-then-vanished', theme: 'ghosting', who: 'A disabled dater', use: 'testimonial',
    voice: "They'd stay for weeks, act completely into it, then disappear the moment they got what they were actually after." },
  { id: 'wrong-people-not-you', theme: 'ghosting', who: 'A disabled dater', use: 'social',
    voice: "The ghosting isn't about you. It's people running into the wrong people. It just stings more when you're already braced for it." },

  // Theme: being seen as your whole self
  { id: 'chair-is-transport', theme: 'seen-whole', who: 'A wheelchair user', use: 'testimonial',
    voice: "To me the wheelchair is just how I get around. To everyone else it somehow became my entire personality." },
  { id: 'treated-like-a-thing', theme: 'seen-whole', who: 'A disabled woman', use: 'social',
    voice: "I watched women get treated like women while I got treated like a thing, doing nothing different. That's the bit that breaks you." },

  // Theme: it does work out (the hope)
  { id: 'stopped-chasing', theme: 'hope', who: 'A disabled dater, now years into a relationship', use: 'testimonial',
    voice: "It came together the moment I stopped chasing and started believing I was worth staying for. We've been together years now." },
  { id: 'once-i-sorted-me', theme: 'hope', who: 'A disabled man', use: 'social',
    voice: "I used to think the disability was the problem. Mostly it was me. Once I sorted that out, I loved and was loved like anyone else." },

  // Theme: age adds nuance (honest, not an excuse)
  { id: 'world-shrinks', theme: 'age', who: 'A disabled dater', use: 'social',
    voice: "Some of it is just getting older, everyone's world shrinks after school and uni. But don't let anyone tell you the ableism isn't real on top of that." },
];

export function voicesByTheme(theme) {
  return VOICES_POOL.filter((v) => v.theme === theme);
}
export function testimonialVoices() {
  return VOICES_POOL.filter((v) => v.use === 'testimonial');
}
// Safe subset for automated captions: excludes sensitive-frame voices unless the
// caller explicitly opts in, so an unattended generator can never post a
// safety/fetish line without the supportive framing around it.
export function socialVoices({ includeSensitive = false } = {}) {
  return VOICES_POOL.filter((v) => (v.use === 'social' || v.use === 'testimonial')
    && (includeSensitive || !v.sensitive));
}
