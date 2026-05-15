import { db } from '../../db/client.js';
import { trendingTopics } from '../../db/schema.js';
import { TREND_CONFIG } from '@smbot/shared';
import { fetchGoogleTrends } from './sources/google-trends.js';
import { fetchTwitterTrends } from './sources/twitter-trends.js';
import { fetchYouTubeTrends } from './sources/youtube-trending.js';
import { fetchTikTokCreativeTrends } from './sources/tiktok-creative.js';
import { scoreAndFilterTrends } from './scorer.js';
import { gt } from 'drizzle-orm';

export async function discoverTrends(): Promise<number> {
  console.log('[Trends] Starting trend discovery...');

  const [googleTrends, twitterTrends, youtubeTrends, tiktokTrends] = await Promise.allSettled([
    fetchGoogleTrends(),
    fetchTwitterTrends(),
    fetchYouTubeTrends(),
    fetchTikTokCreativeTrends(),
  ]);

  const allTrends = [
    ...(googleTrends.status === 'fulfilled' ? googleTrends.value : []),
    ...(twitterTrends.status === 'fulfilled' ? twitterTrends.value : []),
    ...(youtubeTrends.status === 'fulfilled' ? youtubeTrends.value : []),
    ...(tiktokTrends.status === 'fulfilled' ? tiktokTrends.value : []),
  ];

  console.log(`[Trends] Fetched ${allTrends.length} raw trends`);

  const scoredTrends = await scoreAndFilterTrends(allTrends, TREND_CONFIG.RELEVANCE_THRESHOLD);
  console.log(`[Trends] ${scoredTrends.length} trends passed relevance threshold`);

  const expiresAt = new Date(Date.now() + TREND_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000);

  let inserted = 0;
  for (const trend of scoredTrends) {
    try {
      await db.insert(trendingTopics).values({
        source: trend.source,
        topic: trend.topic,
        hashtags: trend.hashtags,
        relevanceScore: trend.relevanceScore,
        rawData: { volume: trend.volume, velocity: trend.velocity },
        expiresAt,
      });
      inserted++;
    } catch (error) {
      // Skip duplicates
    }
  }

  console.log(`[Trends] Stored ${inserted} new trends`);
  return inserted;
}

export async function cleanupExpiredTrends(): Promise<number> {
  const result = await db.delete(trendingTopics).where(
    gt(new Date(), trendingTopics.expiresAt),
  );
  return 0;
}
