import type { ContentType, PlatformType } from '@smbot/shared';
import { PLATFORM_LIMITS } from '@smbot/shared';

export function getContentSystemPrompt(niche: string, tone: string, brandRules?: string): string {
  let prompt = `You are a social media content expert in the niche of "${niche}".
Your tone is ${tone}: helpful, friendly, knowledgeable, and actionable.
You create content that provides genuine value and drives engagement.
Never be salesy or spammy. Focus on helping people achieve real results.`;

  if (brandRules) {
    prompt += `

Brand rules you must follow in every piece of content:
${brandRules}`;
  }

  return prompt;
}

export function getPostGenerationPrompt(
  topic: string,
  platform: PlatformType,
  contentType: ContentType,
): string {
  const limits = PLATFORM_LIMITS[platform];

  if (contentType === 'video' || contentType === 'short' || contentType === 'reel') {
    return `Create a ${contentType} script idea about the trending topic "${topic}".

Include:
- A scroll-stopping hook (first 3 seconds, under 15 words)
- 3-5 key talking points (each 1-2 sentences)
- A strong call to action
- A caption for the post (max ${limits.maxCaptionLength} characters)
- ${limits.maxHashtags} relevant hashtags (mix of trending and evergreen)

Format as JSON:
{
  "hook": "the opening hook",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "callToAction": "what viewers should do",
  "caption": "the post caption",
  "hashtags": ["hashtag1", "hashtag2"]
}`;
  }

  if (contentType === 'carousel') {
    return `Create an Instagram carousel post about the trending topic "${topic}".

Include:
- A cover slide headline (attention-grabbing, under 10 words)
- 5-7 slide contents (each slide: headline + 1-2 sentence explanation)
- A final CTA slide
- A caption for the post (max ${limits.maxCaptionLength} characters)
- ${limits.maxHashtags} relevant hashtags

Format as JSON:
{
  "coverHeadline": "main headline",
  "slides": [{"headline": "...", "body": "..."}],
  "ctaSlide": "follow for more tips",
  "caption": "the post caption",
  "hashtags": ["hashtag1", "hashtag2"]
}`;
  }

  return `Create a ${platform} text post about the trending topic "${topic}".

Include:
- A caption (max ${limits.maxCaptionLength} characters) that hooks, provides value, and ends with a CTA
- ${limits.maxHashtags} relevant hashtags (mix of trending and evergreen)

Format as JSON:
{
  "caption": "the post caption with hook, value, and CTA",
  "hashtags": ["hashtag1", "hashtag2"]
}`;
}

export function getReplyGenerationPrompt(
  postCaption: string,
  commentText: string,
  personality: string,
): string {
  return `You are responding to a comment on a social media post.
Your personality: ${personality} — helpful, friendly, knowledgeable about social media growth.
Keep replies conversational and under 200 characters.
Never be salesy. If someone asks a question, give a genuinely helpful answer.
If it's just a compliment, respond warmly and briefly.

Original post caption: "${postCaption}"
Comment: "${commentText}"

Generate a natural, helpful reply. Return only the reply text, no JSON.`;
}

export function getSafetyCheckPrompt(replyText: string): string {
  return `Review this auto-generated social media reply for safety:

"${replyText}"

Check for:
1. Misinformation or false claims
2. Harmful or offensive content
3. Medical, legal, or financial advice
4. Profanity or inappropriate language
5. Spam-like or overly promotional tone

Respond with JSON: {"safe": true} or {"safe": false, "reason": "explanation"}`;
}
