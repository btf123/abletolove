import type { TrendingItem } from '@smbot/shared';

export async function fetchTikTokCreativeTrends(): Promise<TrendingItem[]> {
  // TikTok Creative Center doesn't have a public API.
  // Two approaches:
  // 1. Use Playwright to scrape https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag
  // 2. Use Apify's TikTok Creative Center Scraper actor
  //
  // For now, we fall back to a curated list of evergreen social media growth hashtags
  // that can be supplemented with real scraping once Playwright is configured.

  try {
    // Attempt Apify if configured
    const apifyToken = process.env.APIFY_TOKEN;
    if (apifyToken) {
      const response = await fetch(
        'https://api.apify.com/v2/acts/doliz~tiktok-creative-center-scraper/run-sync-get-dataset-items?token=' + apifyToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'hashtags', country: 'US', period: 7 }),
        },
      );

      if (response.ok) {
        const data = await response.json() as any[];
        return data.slice(0, 20).map((item) => ({
          topic: item.name || item.hashtag || '',
          hashtags: [`#${(item.name || item.hashtag || '').replace(/^#/, '')}`],
          volume: item.publishCount || item.videoCount || 0,
          velocity: 0,
          source: 'tiktok_creative' as const,
        }));
      }
    }
  } catch (error) {
    console.error('TikTok Creative Center fetch failed:', error);
  }

  // Fallback: evergreen trending topics for social media growth niche
  return [
    { topic: 'social media tips', hashtags: ['#socialmediatips'], volume: 50000, velocity: 0, source: 'tiktok_creative' },
    { topic: 'content creator', hashtags: ['#contentcreator'], volume: 80000, velocity: 0, source: 'tiktok_creative' },
    { topic: 'grow on tiktok', hashtags: ['#growontiktok'], volume: 30000, velocity: 0, source: 'tiktok_creative' },
    { topic: 'algorithm hack', hashtags: ['#algorithmhack'], volume: 25000, velocity: 0, source: 'tiktok_creative' },
    { topic: 'viral tips', hashtags: ['#viraltips'], volume: 40000, velocity: 0, source: 'tiktok_creative' },
  ];
}
