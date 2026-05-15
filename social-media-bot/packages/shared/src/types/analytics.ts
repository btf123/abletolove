import type { PlatformType } from './platform.js';

export interface AnalyticsSnapshot {
  platform: PlatformType;
  accountId: string;
  snapshotDate: Date;
  followers: number;
  following: number;
  totalPosts: number;
  periodLikes: number;
  periodComments: number;
  periodShares: number;
  periodViews: number;
  engagementRate: number;
}

export interface GrowthMetrics {
  platform: PlatformType;
  currentFollowers: number;
  followerChange7d: number;
  followerChange30d: number;
  avgEngagementRate: number;
  topPostId?: string;
}

export interface DashboardOverview {
  totalFollowers: number;
  totalFollowerChange7d: number;
  postsPublishedToday: number;
  postsScheduled: number;
  repliesSentToday: number;
  platformMetrics: GrowthMetrics[];
}
