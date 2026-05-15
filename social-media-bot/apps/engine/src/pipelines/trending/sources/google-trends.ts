import type { TrendingItem } from '@smbot/shared';

export async function fetchGoogleTrends(): Promise<TrendingItem[]> {
  try {
    const googleTrends = await import('google-trends-api');

    const [dailyData, realtimeData] = await Promise.allSettled([
      googleTrends.default.dailyTrends({ geo: 'US' }),
      googleTrends.default.realTimeTrends({ geo: 'US', category: 'all' }),
    ]);

    const items: TrendingItem[] = [];

    if (dailyData.status === 'fulfilled') {
      const parsed = JSON.parse(dailyData.value);
      const days = parsed.default?.trendingSearchesDays || [];
      for (const day of days) {
        for (const search of day.trendingSearches || []) {
          items.push({
            topic: search.title?.query || '',
            hashtags: (search.relatedQueries || []).map((q: any) => q.query),
            volume: parseInt(search.formattedTraffic?.replace(/[^0-9]/g, '') || '0'),
            velocity: 0,
            source: 'google_trends',
          });
        }
      }
    }

    if (realtimeData.status === 'fulfilled') {
      const parsed = JSON.parse(realtimeData.value);
      const stories = parsed.storySummaries?.trendingStories || [];
      for (const story of stories) {
        items.push({
          topic: story.title || story.entityNames?.[0] || '',
          hashtags: (story.entityNames || []).map((n: string) => `#${n.replace(/\s+/g, '')}`),
          volume: 0,
          velocity: 0,
          source: 'google_trends',
        });
      }
    }

    return items.filter((item) => item.topic.length > 0).slice(0, 20);
  } catch (error) {
    console.error('Google Trends fetch failed:', error);
    return [];
  }
}
