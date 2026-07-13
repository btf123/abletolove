# Able2Love — app fix brief (paste into the "build a dating app from scratch" chat)

Three things are wrong or missing in the live app. Fix all three. Details and intended behaviour below.

---

## 1. See Me First — photos are not unblurring (the important one)

**What happens now:** On a See Me First profile, the person's extra photos start blurred, and they stay blurred no matter how many messages get sent. The unblur never happens.

**Intended behaviour:** The more the two people talk, the more the blurred photos come into focus. Every message the user sends should reduce the blur a little, until the photos are fully clear.

**How it should work, concretely:**
- Track the number of messages the current user has sent in this conversation (call it `sentCount`). It must count **messages sent by the current user**, and it must go up immediately when a message is sent.
- The person has several photos. Photo 1 is always visible. Each further photo has a reveal target, staggered so later photos take longer, e.g. photo 2 fully clear at 3 sent messages, photo 3 at 6, photo 4 at 9. (Pick sensible numbers, but stagger them.)
- Blur amount for a given photo = a max blur (e.g. 24) scaled down by progress toward that photo's target: `blur = maxBlur * (1 - clamp(sentCount / target, 0, 1))`. At 0 messages it is fully blurred; at/after the target it is 0 (fully clear).
- The blur must be **reactive**: when `sentCount` changes, the photos must re-render with the new blur. This is almost certainly where the bug is.

**Likely causes of the current bug — check these:**
- The blur value is computed once and never recomputed when a message is sent (not tied to `sentCount` state, or the component is memoised and never re-renders).
- The count is only incremented for **received** messages, or only for the other person's messages, so sending does nothing.
- On Android, a plain `<Image blurRadius={...}>` sometimes does not update when only the blurRadius prop changes — force it by giving the Image a `key` that includes the blur value, or use `expo-blur`'s `BlurView` as an overlay whose `intensity` is driven by state.
- The photos array is empty or only has one photo, so there is nothing to unblur — confirm the test profiles actually have 2+ photos.

**Acceptance test:** Open a See Me First chat where the person has 3+ photos. Their extra photos are blurred. Send one message — they get slightly clearer. Keep sending — they keep clearing, one photo at a time, until fully sharp.

---

## 2. Plan our date — let people send accessible venues to each other

**What's missing:** The "Plan our date" window (the calendar icon in the chat header) currently only lets you browse accessible venues. You cannot send one to the person you are talking to.

**Intended behaviour:** From the Plan our date window, the user picks a step-free / accessible venue and **sends it into the chat** as a message, so both people can see it and agree on the date. The other person receives the venue as a card in the conversation (name, accessibility tags, and a tap to see it on the map). Both sides can send venues, so they organise the date together in the chat.

**Acceptance test:** In a chat, open Plan our date, pick an accessible venue, send it. It appears as a venue card in the conversation for both people. Tapping it shows the venue location.

---

## 3. Two smaller fixes the founder flagged

- **No icons next to names.** Remove the icon that currently sits next to people's names (wherever that appears — matches list / chat list). Just the name, no icon.
- **View profiles directly from wherever you are.** Make a person's name/avatar tappable everywhere it appears (chat, matches, nearby) so you can open their full profile from that spot, without having to go back to Discover.

---

Fix all three, then confirm the See Me First unblur works on a real device, because that is the one the founder specifically reported as broken.
