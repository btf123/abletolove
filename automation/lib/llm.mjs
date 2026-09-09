// Text generation for the Able2Love robots.
//
// Provider preference, best-voice first:
//   1. Anthropic Claude  (ANTHROPIC_API_KEY) - best voice, tiny cost, chosen
//      for the drafting because the free models could not hold the founder's
//      voice without going beige or inventing facts.
//   2. Groq              (GROQ_API_KEY)       - free fallback, keeps the whole
//      machine running at zero cost if the Anthropic key is ever missing.
//   3. Google Gemini     (GEMINI_API_KEY)     - last-ditch fallback.
//
// Anthropic key: https://console.anthropic.com (create key, add a little
// prepaid credit) saved as the ANTHROPIC_API_KEY repo secret. Model defaults
// to Claude Sonnet; override with ANTHROPIC_MODEL if wanted.
// Free Groq key: https://console.groq.com/keys (no card) as GROQ_API_KEY.

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
// Preference order only. Groq retires model names without warning, and a
// hardcoded list is exactly why the outreach brief failed every day through
// August: both names had been decommissioned and every run 404'd. The real
// list is fetched from the account at run time, and this is the fallback.
// allam-2-7b and friends are small enough to produce unusable copy and broken
// JSON, and the ranking used to fall through to them whenever the good models
// were busy. Anything matching NEVER_GROQ is dropped from the usable list.
const NEVER_GROQ = /allam|gemma2-9b|-8b-|8b-instant|compound/i;
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'moonshotai/kimi-k2-instruct',
  'qwen/qwen3-32b',
  'gemma2-9b-it',
];
// Google retires model names and locks the old ones to existing users only, so
// a new key gets a 404 on anything stale. gemini-2.5-flash died exactly that
// way: "no longer available to new users, please update to gemini-3.6-flash".
// Newest first, older ones kept as a cushion for keys that still have them.
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// GEMINI FIRST. His Anthropic balance is empty, so every run was paying the
// cost of a failed call and then dropping to whatever weak Groq model happened
// to be free that minute, which is where the beige drafts came from. Google AI
// Studio's free tier is both free and far stronger than that fallback, so when
// a Gemini key exists it leads and everything else backs it up.
export function llmProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GROQ_API_KEY) return 'groq';
  return null;
}

async function callAnthropic(prompt, temperature) {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  // A key with a non-ASCII character never authenticates and makes fetch throw
  // a cryptic ByteString error. This happens when smart-paste turns a hyphen in
  // the key into a dash. Reject it early with a message that says what to do.
  if (/[^\x00-\x7F]/.test(key)) {
    throw new Error('ANTHROPIC_API_KEY has a non-standard character (a hyphen was probably auto-corrected to a dash on paste). Delete the secret and re-add it, pasting the key as plain text.');
  }
  const url = 'https://api.anthropic.com/v1/messages';
  // The newer Claude models (e.g. claude-sonnet-5) reject a `temperature`
  // parameter outright ("temperature is deprecated for this model"), so we do
  // not send one. The `temperature` argument is kept for interface parity with
  // the other providers but is intentionally unused here.
  void temperature;
  let lastError;
  // Anthropic returns 429 (rate) and 529 (overloaded) during busy spikes. Those
  // pass in seconds, so ride them out with real exponential backoff before
  // yielding to the free fallback, rather than bailing after a few seconds.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        const hopeless = res.status === 400 || res.status === 401 || res.status === 403;
        throw Object.assign(new Error(`Anthropic HTTP ${res.status}: ${body}`), { fatal: hopeless });
      }
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || '').join('');
      if (!text) throw new Error('Anthropic returned no text');
      console.log(`Model used: anthropic/${ANTHROPIC_MODEL}`);
      return text;
    } catch (error) {
      lastError = error;
      console.warn(`anthropic attempt ${attempt} failed: ${error.message.slice(0, 200)}`);
      // No amount of waiting fixes an empty credit balance or a bad key.
      if (error.fatal) {
        console.warn('That is a billing or key problem, not a busy server. Going straight to the fallback.');
        break;
      }
      if (attempt < MAX_ATTEMPTS) {
        // 3s, 6s, 12s, 24s: ~45s of patience for a transient overload spike.
        await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

// Does the active provider have live web search? Only paid Gemini grounding
// here. Groq does not, so callers must not ask it to cite fresh posts.
export function hasLiveSearch() {
  return llmProvider() === 'gemini';
}

/**
 * What this Groq key can actually serve today, best first.
 *
 * Asking beats assuming: model names get retired and a fixed list silently
 * turns into daily 404s. Chat models only, so speech and moderation models
 * never get picked by accident.
 */
let groqModelsCache = null;
async function groqModels(key) {
  if (groqModelsCache) return groqModelsCache;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const ids = ((await res.json()).data || [])
        .map((m) => m.id)
        .filter((id) => id && !/whisper|tts|guard|prompt-?guard|vision|embed/i.test(id));
      const usable = ids.filter((id) => !NEVER_GROQ.test(id));
      const ranked = [
        ...GROQ_MODELS.filter((m) => usable.includes(m)),
        ...usable.filter((id) => !GROQ_MODELS.includes(id)),
      ];
      if (ranked.length) {
        groqModelsCache = ranked.slice(0, 4);
        console.log(`Groq models this key can use: ${groqModelsCache.join(', ')}`);
        return groqModelsCache;
      }
    } else {
      console.warn(`Groq model list unavailable (HTTP ${res.status}); using the built-in order.`);
    }
  } catch (error) {
    console.warn(`Groq model list failed (${error.message.slice(0, 120)}); using the built-in order.`);
  }
  groqModelsCache = GROQ_MODELS;
  return groqModelsCache;
}

async function callGroq(prompt, temperature) {
  const key = process.env.GROQ_API_KEY;
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  let lastError;
  for (const model of await groqModels(key)) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature, messages: [{ role: 'user', content: prompt }] }),
        });
        if (res.status === 429 || res.status === 404) {
          throw Object.assign(new Error(`Groq ${model} HTTP ${res.status}: ${await res.text()}`), { skipModel: true });
        }
        if (!res.ok) throw new Error(`Groq ${model} HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error(`Groq ${model} returned no text`);
        console.log(`Model used: groq/${model}`);
        return text;
      } catch (error) {
        lastError = error;
        console.warn(`groq/${model} attempt ${attempt} failed: ${error.message.slice(0, 200)}`);
        if (error.skipModel) break;
        await new Promise((r) => setTimeout(r, attempt * 8000));
      }
    }
  }
  throw lastError;
}

async function callGemini(prompt, temperature, search) {
  const key = process.env.GEMINI_API_KEY;
  let lastError;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // Gemini 3.x models THINK before they answer, and that thinking is paid
        // for out of the same output budget. Left alone they spend most of it
        // reasoning and hand back a short or half-finished reply, which is
        // exactly what was showing up in the drafts. So: give the answer room,
        // and on the second attempt turn thinking off entirely.
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: 4096 },
        };
        if (attempt > 1) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        if (search) body.tools = [{ google_search: {} }];
        const res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status === 404) {
          throw Object.assign(new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`), { skipModel: true });
        }
        if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const cand = data.candidates?.[0] || {};
        const parts = cand.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (!text) {
          throw new Error(`Gemini ${model} returned no text`
            + (cand.finishReason ? ` (finishReason ${cand.finishReason})` : ''));
        }
        if (cand.finishReason === 'MAX_TOKENS') {
          console.warn(`${model} hit the output cap and the reply may be cut short.`);
        }
        console.log(`Model used: ${model}`);
        return text;
      } catch (error) {
        lastError = error;
        console.warn(`${model} attempt ${attempt} failed: ${error.message.slice(0, 200)}`);
        if (error.skipModel) break;
        await new Promise((r) => setTimeout(r, attempt * 15000));
      }
    }
  }
  throw lastError;
}

export async function generateText(prompt, { temperature = 0.8, search = false } = {}) {
  const provider = llmProvider();
  if (provider === 'anthropic') {
    try {
      return await callAnthropic(prompt, temperature);
    } catch (error) {
      // Never let an Anthropic problem (bad key, outage, no credit) red-fail the
      // whole brief. Drop to free Groq for this call if it is available, loudly.
      if (process.env.GROQ_API_KEY) {
        console.warn(`Anthropic unavailable, using free Groq for this call. Reason: ${error.message.slice(0, 200)}`);
        return callGroq(prompt, temperature);
      }
      throw error;
    }
  }
  if (provider === 'gemini') {
    try {
      return await callGemini(prompt, temperature, search);
    } catch (error) {
      // A daily quota or a blip must never lose the day's brief.
      if (process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY) {
        console.warn(`Gemini unavailable, falling back for this call. Reason: ${error.message.slice(0, 200)}`);
        if (process.env.ANTHROPIC_API_KEY) {
          try { return await callAnthropic(prompt, temperature); } catch { /* keep going */ }
        }
        if (process.env.GROQ_API_KEY) return callGroq(prompt, temperature);
      }
      throw error;
    }
  }
  if (provider === 'groq') return callGroq(prompt, temperature);
  throw new Error('No LLM API key set. Add GEMINI_API_KEY (free, best value) or GROQ_API_KEY (free) as a repo secret.');
}
