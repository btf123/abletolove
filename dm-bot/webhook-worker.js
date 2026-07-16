/**
 * Able2Love DM assistant — Cloudflare Worker (free tier, always on).
 *
 * Receives Instagram DMs via the Meta webhook, answers app-support questions in
 * Brogan's voice using Groq (free), and hands off anything sensitive to a human.
 * Inbound only: it only ever replies to people who message the account first.
 *
 * Deploy free at cloudflare.com (Workers). Set these Worker variables/secrets:
 *   VERIFY_TOKEN      any string you choose; also entered in the Meta webhook setup
 *   APP_SECRET        your Meta app secret (verifies the webhook is really Meta)
 *   PAGE_ACCESS_TOKEN the page/IG access token used to send replies
 *   GROQ_API_KEY      your free Groq key
 * See marketing/14-dm-assistant.md for the full setup.
 */

const KNOWLEDGE_URL = 'https://raw.githubusercontent.com/btf123/abletolove/main/dm-bot/knowledge.md';
const GRAPH = 'https://graph.facebook.com/v21.0';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const RAILS = `You are the Able2Love assistant, a support bot for a dating app for disabled and non-disabled people. You are NOT a person and never pretend to be one. Warm, plain, dryly friendly, UK English, no em or en dashes, no pity or inspiration language, short answers.

Answer ONLY plain app-support questions (what the app is, cost, where to download, how features work, simple how-to, bug reports, how to reach a human), using ONLY the KNOWLEDGE below. Never invent features, prices, dates, numbers or partnerships. Never share Brogan's private contact details.

STOP and hand off (escalate) for anything else: personal/emotional/relationship/health talk; flirtation or sexual content; anyone who seems to think they are messaging a match or a real person; anyone asking if you are a bot (tell them plainly you are the assistant); reports about another user, harassment or safety; anyone who may be under 18; legal, money, or account-deletion/data requests. When escalating, reply only: that you are the Able2Love assistant, you have passed this to Brogan, and he will come back to them. Then stop.

CRISIS (overrides all): if someone expresses distress, hopelessness, self-harm or danger, do not counsel them. Reply briefly and kindly, say a person will help, and signpost: in the UK, Samaritans on 116 123 any time, or 999 in an emergency.

Return STRICT JSON only: {"reply":"...","escalate":true|false,"category":"faq|bug|contact|escalate|crisis"}. On escalate or crisis, "reply" is only the safe handoff/crisis message.`;

async function verifySignature(secret, rawBody, header) {
  if (!header) return false;
  const expected = header.replace('sha256=', '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // constant-time-ish compare
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function buildReply(text, env) {
  let knowledge = '';
  try {
    const k = await fetch(KNOWLEDGE_URL, { cf: { cacheTtl: 300 } });
    if (k.ok) knowledge = await k.text();
  } catch { /* fall back to rails only */ }

  const prompt = `${RAILS}\n\nKNOWLEDGE:\n${knowledge}\n\nUser message: ${JSON.stringify(text)}`;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    if (parsed.reply) return parsed;
  } catch { /* fall through to safe default */ }

  // If anything went wrong, never guess: hand off safely.
  return {
    reply: "Thanks for the message. I'm the Able2Love assistant and I've passed this to Brogan, who will come back to you.",
    escalate: true,
    category: 'escalate',
  };
}

async function sendMessage(recipientId, text, env) {
  await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(env.PAGE_ACCESS_TOKEN)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 900) } }),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Webhook verification handshake (Meta calls this once when you subscribe).
    if (request.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe'
        && url.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN) {
        return new Response(url.searchParams.get('hub.challenge'), { status: 200 });
      }
      return new Response('forbidden', { status: 403 });
    }

    if (request.method !== 'POST') return new Response('ok');

    const raw = await request.text();
    if (!(await verifySignature(env.APP_SECRET, raw, request.headers.get('x-hub-signature-256')))) {
      return new Response('bad signature', { status: 403 });
    }

    let body;
    try { body = JSON.parse(raw); } catch { return new Response('ok'); }

    // Handle each inbound message. Reply work runs after we return 200 to Meta.
    const jobs = [];
    for (const entry of body.entry || []) {
      const events = entry.messaging || entry.changes || [];
      for (const ev of events) {
        const msg = ev.message || ev.value?.message;
        const senderId = ev.sender?.id || ev.value?.sender?.id;
        const textIn = msg?.text;
        if (!senderId || msg?.is_echo) continue; // ignore our own echoes
        if (!textIn) {
          jobs.push(sendMessage(senderId,
            "Thanks for the message. I'm the Able2Love assistant, I can only read text just now, so I've passed this to Brogan.", env));
          continue;
        }
        jobs.push(buildReply(textIn, env).then((r) => sendMessage(senderId, r.reply, env)));
      }
    }
    ctx.waitUntil(Promise.allSettled(jobs));
    return new Response('ok', { status: 200 });
  },
};
