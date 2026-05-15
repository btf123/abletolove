import { db } from '../db/client.js';
import { analyticsSnapshots, postAnalytics, scheduledPosts, platformAccounts } from '../db/schema.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import type { PlatformType, GrowthMetrics, DashboardOverview } from '@smbot/shared';

export async function getGrowthMetrics(accountId: string, platform: PlatformType): Promise<GrowthMetrics> {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [latest] = await db.select()
    .from(analyticsSnapshots)
    .where(eq(analyticsSnapshots.accountId, accountId))
    .orderBy(desc(analyticsSnapshots.snapshotDate))
    .limit(1);

  const [weekAgo] = await db.select()
    .from(analyticsSnapshots)
    .where(and(
      eq(analyticsSnapshots.accountId, accountId),
      gte(analyticsSnapshots.snapshotDate, sevenDaysAgo),
    ))
    .orderBy(analyticsSnapshots.snapshotDate)
    .limit(1);

  const [monthAgo] = await db.select()
    .from(analyticsSnapshots)
    .where(and(
      eq(analyticsSnapshots.accountId, accountId),
      gte(analyticsSnapshots.snapshotDate, thirtyDaysAgo),
    ))
    .orderBy(analyticsSnapshots.snapshotDate)
    .limit(1);

  return {
    platform,
    currentFollowers: latest?.followers || 0,
    followerChange7d: (latest?.followers || 0) - (weekAgo?.followers || 0),
    followerChange30d: (latest?.followers || 0) - (monthAgo?.followers || 0),
    avgEngagementRate: latest?.engagementRate || 0,
  };
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const accounts = await db.select()
    .from(platformAccounts)
    .where(eq(platformAccounts.isActive, true));

  const platformMetrics: GrowthMetrics[] = [];
  let totalFollowers = 0;
  let totalChange7d = 0;

  for (const account of accounts) {
    const metrics = await getGrowthMetrics(account.id, account.platform as PlatformType);
    platformMetrics.push(metrics);
    totalFollowers += metrics.currentFollowers;
    totalChange7d += metrics.followerChange7d;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [publishedToday] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledPosts)
    .where(and(
      eq(scheduledPosts.status, 'published'),
      gte(scheduledPosts.publishedAt!, todayStart),
    ));

  const [scheduledCount] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledPosts)
    .where(eq(scheduledPosts.status, 'pending'));

  return {
    totalFollowers,
    totalFollowerChange7d: totalChange7d,
    postsPublishedToday: Number(publishedToday?.count || 0),
    postsScheduled: Number(scheduledCount?.count || 0),
    repliesSentToday: 0,
    platformMetrics,
  };
}
