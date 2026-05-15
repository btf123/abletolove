import type { TrendingItem } from '@smbot/shared';
import { getPlatform } from '../../../platforms/registry.js';

export async function fetchTwitterTrends(): Promise<TrendingItem[]> {
  try {
    const twitter = getPlatform('twitter');
    if (!twitter.fetchTrending) return [];
    return await twitter.fetchTrending();
  } catch (error) {
    console.error('Twitter trends fetch failed:', error);
    return [];
  }
}
