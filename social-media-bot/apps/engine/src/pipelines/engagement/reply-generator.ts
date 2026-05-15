import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { systemConfig } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getReplyGenerationPrompt } from '../content/prompts.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function getReplyPersonality(): Promise<string> {
  try {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, 'reply_personality'));
    if (config?.value) return config.value as string;
  } catch {
    // DB may not be ready
  }
  return 'friendly, helpful, and knowledgeable about social media growth';
}

export async function generateReply(postCaption: string, commentText: string): Promise<string> {
  const personality = await getReplyPersonality();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: getReplyGenerationPrompt(postCaption, commentText, personality) },
    ],
    max_tokens: 100,
    temperature: 0.7,
  });

  return (response.choices[0].message.content || '').trim().slice(0, 200);
}
