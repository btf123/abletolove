// Free-first text generation for the Able2Love robots.
//
// Prefers Groq (free API, no card, works in the UK) when GROQ_API_KEY is set.
// Falls back to Google Gemini only if GEMINI_API_KEY is set instead. This
// keeps the whole machine running at zero cost with no payment details.
//
// Get a free Groq key at https://console.groq.com/keys (sign in, create key,
// no card) and save it as the GROQ_API_KEY repo secret.

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

export function llmProvider() {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

// Does the active provider have live web search? Only paid Gemini grounding
// here. Groq does not, so callers must not ask it to cite fresh posts.
export function hasLiveSearch() {
  return llmProvider() === 'gemini';
}

async function callGroq(prompt, temperature) {
  const key = process.env.GROQ_API_KEY;
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  let lastError;
  for (const model of GROQ_MODELS) {
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
        const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } };
        if (search) body.tools = [{ google_search: {} }];
        const res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status === 404) {
          throw Object.assign(new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`), { skipModel: true });
        }
        if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (!text) throw new Error(`Gemini ${model} returned no text`);
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
  if (provider === 'groq') return callGroq(prompt, temperature);
  if (provider === 'gemini') return callGemini(prompt, temperature, search);
  throw new Error('No LLM API key set. Add GROQ_API_KEY (free, no card) or GEMINI_API_KEY as a repo secret.');
}
