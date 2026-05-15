import { db } from '../db/client.js';
import { platformAccounts, analyticsSnapshots, scheduledPosts, postAnalytics } from '../db/schema.js';
import { getPlatform } from '../platforms/registry.js';
import { eq, and, gt, isNotNull } from 'drizzle-orm';
import type { PlatformType } from '@smbot/shared';

export async function collectAnalytics(): Promise<{ accounts: number; posts: number }> {
  console.log('[Analytics] Starting collection...');

  const accounts = await db.select()
    .from(platformAccounts)
    .where(eq(platformAccounts.isActive, true));

  let accountsProcessed = 0;
  let postsProcessed = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const account of accounts) {
    try {
      const platform = getPlatform(account.platform as PlatformType);
      const metrics = await platform.getAccountMetrics(account.id);

      await db.insert(analyticsSnapshots)
        .values({
          platform: account.platform,
          accountId: account.id,
          snapshotDate: today,
          followers: metrics.followers,
          following: metrics.following,
          totalPosts: metrics.totalPosts,
          rawData: metrics,
        })
        .onConflictDoUpdate({
          target: [analyticsSnapshots.accountId, analyticsSnapshots.snapshotDate],
          set: {
            followers: metrics.followers,
            following: metrics.following,
            totalPosts: metrics.totalPosts,
            rawData: metrics,
          },
        });

      accountsProcessed++;
    } catch (error) {
      console.error(`[Analytics] Failed for account ${account.accountName}:`, error);
    }
  }

  // Collect per-post metrics for recent published posts
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPosts = await db.select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, 'published'),
        gt(scheduledPosts.publishedAt!, thirtyDaysAgo),
        isNotNull(scheduledPosts.platformPostId),
      ),
    );

  for (const post of recentPosts) {
    try {
      const platform = getPlatform(post.platform as PlatformType);
      const metrics = await platform.getPostMetrics(post.accountId, post.platformPostId!);

      await db.insert(postAnalytics).values({
        scheduledPostId: post.id,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        reach: metrics.reach,
        engagementRate: metrics.engagementRate,
      });

      postsProcessed++;
    } catch (error) {
      console.error(`[Analytics] Post metrics failed for ${post.id}:`, error);
    }
  }

  console.log(`[Analytics] Processed ${accountsProcessed} accounts, ${postsProcessed} posts`);
  return { accounts: accountsProcessed, posts: postsProcessed };
}

export async function refreshAllTokens(): Promise<{ refreshed: number; failed: number }> {
  console.log('[Tokens] Starting token refresh...');

  const accounts = await db.select()
    .from(platformAccounts)
    .where(eq(platformAccounts.isActive, true));

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const platform = getPlatform(account.platform as PlatformType);
      const valid = await platform.isTokenValid(account.id);

      if (!valid) {
        await platform.refreshToken(account.id);
        refreshed++;
        console.log(`[Tokens] Refreshed token for ${account.accountName}`);
      }
    } catch (error) {
      failed++;
      console.error(`[Tokens] Refresh failed for ${account.accountName}:`, error);
    }
  }

  console.log(`[Tokens] Refreshed ${refreshed}, failed ${failed}`);
  return { refreshed, failed };
}
