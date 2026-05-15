import type { TrendingItem } from '@smbot/shared';
import { getPlatform } from '../../../platforms/registry.js';

export async function fetchYouTubeTrends(): Promise<TrendingItem[]> {
  try {
    const youtube = getPlatform('youtube');
    if (!youtube.fetchTrending) return [];
    return await youtube.fetchTrending();
  } catch (error) {
    console.error('YouTube trends fetch failed:', error);
    return [];
  }
}
