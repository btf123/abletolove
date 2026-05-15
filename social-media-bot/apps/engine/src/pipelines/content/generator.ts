import OpenAI from 'openai';
import { db } from '../../db/client.js';
import { trendingTopics, contentQueue, scheduledPosts, platformAccounts, systemConfig } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { getContentSystemPrompt, getPostGenerationPrompt } from './prompts.js';
import { formatForPlatform, getContentTypeForPlatform } from './formatter.js';
import { DEFAULT_POSTING_WINDOWS } from '@smbot/shared';
import { desc, eq, gt, and, isNull } from 'drizzle-orm';
import type { PlatformType } from '@smbot/shared';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function getConfig(): Promise<{ niche: string; tone: string; postsPerDay: number; autoApprove: boolean }> {
  try {
    const configs = await db.select().from(systemConfig);
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    return {
      niche: (configMap.niche as string) || 'social media growth tips',
      tone: (configMap.content_tone as string) || 'friendly, helpful, and expert',
      postsPerDay: (configMap.posts_per_day as number) || 2,
      autoApprove: (configMap.auto_approve_content as boolean) ?? true,
    };
  } catch {
    return { niche: 'social media growth tips', tone: 'friendly, helpful, and expert', postsPerDay: 2, autoApprove: true };
  }
}

async function getActiveAccounts(): Promise<Array<{ id: string; platform: PlatformType }>> {
  const accounts = await db.select({ id: platformAccounts.id, platform: platformAccounts.platform })
    .from(platformAccounts)
    .where(eq(platformAccounts.isActive, true));
  return accounts as Array<{ id: string; platform: PlatformType }>;
}

export async function generateContent(): Promise<number> {
  console.log('[Content] Starting content generation...');
  const config = await getConfig();

  const trends = await db.select()
    .from(trendingTopics)
    .where(gt(trendingTopics.expiresAt, new Date()))
    .orderBy(desc(trendingTopics.relevanceScore))
    .limit(10);

  if (trends.length === 0) {
    console.log('[Content] No active trends found, using generic topics');
  }

  const accounts = await getActiveAccounts();
  if (accounts.length === 0) {
    console.log('[Content] No active accounts, skipping generation');
    return 0;
  }

  const platformSet = new Set(accounts.map((a) => a.platform));
  let totalGenerated = 0;

  for (let day = 0; day < 7; day++) {
    for (const platform of platformSet) {
      for (let post = 0; post < config.postsPerDay; post++) {
        const trend = trends[totalGenerated % Math.max(trends.length, 1)];
        const topic = trend?.topic || getGenericTopic(totalGenerated);
        const contentType = getContentTypeForPlatform(platform);

        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: getContentSystemPrompt(config.niche, config.tone) },
              { role: 'user', content: getPostGenerationPrompt(topic, platform, contentType) },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.8,
          });

          const rawContent = JSON.parse(response.choices[0].message.content || '{}');
          const formatted = formatForPlatform(rawContent, platform, contentType);

          const [inserted] = await db.insert(contentQueue).values({
            status: config.autoApprove ? 'approved' : 'draft',
            contentType,
            caption: formatted.caption,
            hashtags: formatted.hashtags,
            mediaUrls: formatted.mediaUrls,
            inspiredBy: trend?.id || null,
            targetPlatforms: [platform],
            approvedAt: config.autoApprove ? new Date() : null,
          }).returning();

          if (config.autoApprove && inserted) {
            const account = accounts.find((a) => a.platform === platform);
            if (account) {
              const scheduledTime = getOptimalPostTime(platform, day, post);
              await db.insert(scheduledPosts).values({
                contentId: inserted.id,
                platform,
                accountId: account.id,
                scheduledFor: scheduledTime,
              });
            }
          }

          totalGenerated++;
        } catch (error) {
          console.error(`[Content] Generation failed for ${platform}:`, error);
        }
      }
    }
  }

  console.log(`[Content] Generated ${totalGenerated} content items`);
  return totalGenerated;
}

function getOptimalPostTime(platform: PlatformType, dayOffset: number, postIndex: number): Date {
  const windows = DEFAULT_POSTING_WINDOWS.find((w) => w.platform === platform);
  const hours = windows?.hours || [12];
  const hour = hours[postIndex % hours.length];

  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, Math.floor(Math.random() * 15), 0, 0);
  return date;
}

const GENERIC_TOPICS = [
  'How to grow from 0 to 1000 followers',
  'The best posting times for maximum engagement',
  'How the algorithm actually works',
  '5 hashtag mistakes killing your reach',
  'Why consistency matters more than going viral',
  'How to create a content calendar that works',
  'Engagement hacks that actually work',
  'How to find your niche and dominate it',
  'Understanding analytics to grow faster',
  'Collaboration strategies for small creators',
];

function getGenericTopic(index: number): string {
  return GENERIC_TOPICS[index % GENERIC_TOPICS.length];
}
