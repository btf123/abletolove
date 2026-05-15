import type { TrendingItem } from '@smbot/shared';
import { db } from '../../db/client.js';
import { systemConfig } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const DEFAULT_NICHE_KEYWORDS = [
  'social media', 'tiktok', 'instagram', 'youtube', 'content creator',
  'followers', 'engagement', 'viral', 'algorithm', 'hashtag',
  'influencer', 'grow', 'growth', 'audience', 'reach',
  'content strategy', 'posting', 'reels', 'shorts', 'trends',
  'monetize', 'brand', 'niche', 'analytics', 'marketing',
];

async function getNicheKeywords(): Promise<string[]> {
  try {
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, 'niche_keywords'));
    if (config?.value && Array.isArray(config.value)) {
      return config.value as string[];
    }
  } catch {
    // DB may not be ready yet
  }
  return DEFAULT_NICHE_KEYWORDS;
}

export async function scoreTrendRelevance(trend: TrendingItem): Promise<number> {
  const keywords = await getNicheKeywords();
  const topicLower = trend.topic.toLowerCase();
  const allText = [topicLower, ...trend.hashtags.map((h) => h.toLowerCase())].join(' ');

  let matchCount = 0;
  for (const keyword of keywords) {
    if (allText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  const keywordScore = Math.min(matchCount / 3, 1.0);
  const volumeBonus = trend.volume > 100000 ? 0.1 : trend.volume > 10000 ? 0.05 : 0;

  return Math.min(keywordScore + volumeBonus, 1.0);
}

export async function scoreAndFilterTrends(trends: TrendingItem[], threshold: number = 0.3): Promise<Array<TrendingItem & { relevanceScore: number }>> {
  const scored = await Promise.all(
    trends.map(async (trend) => ({
      ...trend,
      relevanceScore: await scoreTrendRelevance(trend),
    })),
  );

  return scored
    .filter((t) => t.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
