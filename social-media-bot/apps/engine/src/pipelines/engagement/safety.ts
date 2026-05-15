import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { getSafetyCheckPrompt } from '../content/prompts.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const BLOCKED_KEYWORDS = [
  'buy followers', 'dm me', 'check my bio', 'link in bio',
  'make money fast', 'guaranteed results', 'click here',
];

export async function checkReplySafety(replyText: string): Promise<{ safe: boolean; reason?: string }> {
  const lowerReply = replyText.toLowerCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lowerReply.includes(keyword)) {
      return { safe: false, reason: `Contains blocked phrase: "${keyword}"` };
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a content safety reviewer. Respond only with JSON.' },
        { role: 'user', content: getSafetyCheckPrompt(replyText) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"safe": true}');
    return result;
  } catch (error) {
    console.error('[Safety] LLM check failed, defaulting to safe:', error);
    return { safe: true };
  }
}
