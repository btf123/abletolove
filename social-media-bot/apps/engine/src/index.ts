import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerCronJobs } from './scheduler/cron-definitions.js';
import { registerPlatform } from './platforms/registry.js';
import { TwitterAdapter } from './platforms/twitter/adapter.js';
import { TikTokAdapter } from './platforms/tiktok/adapter.js';
import { InstagramAdapter } from './platforms/instagram/adapter.js';
import { YouTubeAdapter } from './platforms/youtube/adapter.js';
import { getDashboardOverview } from './analytics/aggregator.js';
import {
  getOAuthUrl,
  exchangeTwitterCode,
  exchangeTikTokCode,
  exchangeInstagramCode,
  exchangeYouTubeCode,
} from './platforms/oauth.js';
import { db } from './db/client.js';
import {
  contentQueue as contentQueueTable,
  scheduledPosts,
  trendingTopics,
  engagementReplies,
  platformAccounts,
  systemConfig,
  analyticsSnapshots,
} from './db/schema.js';
import { eq, desc, gt, and, sql } from 'drizzle-orm';
import { discoverTrends } from './pipelines/trending/aggregator.js';
import { generateContent } from './pipelines/content/generator.js';
import { processComments } from './pipelines/engagement/responder.js';
import { collectAnalytics, refreshAllTokens } from './analytics/collector.js';
import { getRegisteredPlatformNames } from './platforms/registry.js';

// Import workers to start them
import './scheduler/workers/trend-discovery.js';
import './scheduler/workers/content-generation.js';
import './scheduler/workers/post-publisher.js';
import './scheduler/workers/comment-responder.js';
import './scheduler/workers/analytics-collector.js';

async function start() {
  console.log('Social Media Bot Engine starting...');

  // Register platform adapters
  registerPlatform(new TwitterAdapter());
  registerPlatform(new TikTokAdapter());
  registerPlatform(new InstagramAdapter());
  registerPlatform(new YouTubeAdapter());
  console.log('[OK] Platform adapters registered');

  // Register cron jobs (requires Redis)
  try {
    await registerCronJobs();
    console.log('[OK] Cron jobs registered');
  } catch (error) {
    console.warn('[WARN] Could not register cron jobs (is Redis running?):', (error as Error).message);
    console.warn('[WARN] The API will still work, but automated jobs will not run.');
  }

  // Start REST API for dashboard
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: env.DASHBOARD_URL });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Dashboard API routes
  app.get('/api/overview', async () => {
    return await getDashboardOverview();
  });

  app.get('/api/content', async (req) => {
    const { status } = req.query as { status?: string };
    let query = db.select().from(contentQueueTable).orderBy(desc(contentQueueTable.generatedAt)).limit(50);
    if (status) {
      return db.select().from(contentQueueTable)
        .where(eq(contentQueueTable.status, status as any))
        .orderBy(desc(contentQueueTable.generatedAt))
        .limit(50);
    }
    return query;
  });

  app.patch('/api/content/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string; caption?: string; hashtags?: string[] };
    const updates: Record<string, any> = {};
    if (body.status) updates.status = body.status;
    if (body.caption) updates.caption = body.caption;
    if (body.hashtags) updates.hashtags = body.hashtags;
    if (body.status === 'approved') updates.approvedAt = new Date();

    const [updated] = await db.update(contentQueueTable)
      .set(updates)
      .where(eq(contentQueueTable.id, id))
      .returning();
    return updated;
  });

  app.get('/api/schedule', async () => {
    return db.select()
      .from(scheduledPosts)
      .innerJoin(contentQueueTable, eq(scheduledPosts.contentId, contentQueueTable.id))
      .orderBy(scheduledPosts.scheduledFor)
      .limit(100);
  });

  app.get('/api/trends', async () => {
    return db.select()
      .from(trendingTopics)
      .where(gt(trendingTopics.expiresAt, new Date()))
      .orderBy(desc(trendingTopics.relevanceScore))
      .limit(50);
  });

  app.get('/api/engagement', async () => {
    return db.select()
      .from(engagementReplies)
      .orderBy(desc(engagementReplies.repliedAt))
      .limit(50);
  });

  app.get('/api/accounts', async () => {
    return db.select({
      id: platformAccounts.id,
      platform: platformAccounts.platform,
      accountName: platformAccounts.accountName,
      isActive: platformAccounts.isActive,
      connectedAt: platformAccounts.connectedAt,
    }).from(platformAccounts);
  });

  app.post('/api/accounts', async (req) => {
    const body = req.body as { platform: string; accountName: string; credentials: Record<string, string> };
    const [account] = await db.insert(platformAccounts).values({
      platform: body.platform as any,
      accountName: body.accountName,
      credentials: body.credentials,
    }).returning();
    return account;
  });

  app.get('/api/config', async () => {
    return db.select().from(systemConfig);
  });

  app.put('/api/config/:key', async (req) => {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: any };
    await db.insert(systemConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value, updatedAt: new Date() },
      });
    return { key, value };
  });

  app.get('/api/analytics/:accountId', async (req) => {
    const { accountId } = req.params as { accountId: string };
    return db.select()
      .from(analyticsSnapshots)
      .where(eq(analyticsSnapshots.accountId, accountId))
      .orderBy(desc(analyticsSnapshots.snapshotDate))
      .limit(90);
  });

  // Manual trigger endpoints — run pipelines on demand from the dashboard
  app.post('/api/trigger/trends', async () => {
    const count = await discoverTrends();
    return { success: true, trendsDiscovered: count };
  });

  app.post('/api/trigger/content', async () => {
    const count = await generateContent();
    return { success: true, contentGenerated: count };
  });

  app.post('/api/trigger/engagement', async () => {
    const result = await processComments();
    return { success: true, ...result };
  });

  app.post('/api/trigger/analytics', async () => {
    const result = await collectAnalytics();
    return { success: true, ...result };
  });

  app.post('/api/trigger/tokens', async () => {
    const result = await refreshAllTokens();
    return { success: true, ...result };
  });

  // Status endpoint — full system status
  app.get('/api/status', async () => {
    const [accountCount] = await db.select({ count: sql<number>`count(*)` }).from(platformAccounts).where(eq(platformAccounts.isActive, true));
    const [pendingPosts] = await db.select({ count: sql<number>`count(*)` }).from(scheduledPosts).where(eq(scheduledPosts.status, 'pending'));
    const [publishedPosts] = await db.select({ count: sql<number>`count(*)` }).from(scheduledPosts).where(eq(scheduledPosts.status, 'published'));
    const [draftContent] = await db.select({ count: sql<number>`count(*)` }).from(contentQueueTable).where(eq(contentQueueTable.status, 'draft'));
    const [activeTrends] = await db.select({ count: sql<number>`count(*)` }).from(trendingTopics).where(gt(trendingTopics.expiresAt, new Date()));
    const [repliesSent] = await db.select({ count: sql<number>`count(*)` }).from(engagementReplies).where(eq(engagementReplies.replyStatus, 'sent'));
    const [repliesFlagged] = await db.select({ count: sql<number>`count(*)` }).from(engagementReplies).where(eq(engagementReplies.replyStatus, 'flagged'));

    return {
      platforms: getRegisteredPlatformNames(),
      connectedAccounts: Number(accountCount?.count || 0),
      pendingPosts: Number(pendingPosts?.count || 0),
      publishedPosts: Number(publishedPosts?.count || 0),
      draftContent: Number(draftContent?.count || 0),
      activeTrends: Number(activeTrends?.count || 0),
      repliesSent: Number(repliesSent?.count || 0),
      repliesFlagged: Number(repliesFlagged?.count || 0),
      openaiConfigured: !!env.OPENAI_API_KEY,
    };
  });

  // Delete content
  app.delete('/api/content/:id', async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(scheduledPosts).where(eq(scheduledPosts.contentId, id));
    await db.delete(contentQueueTable).where(eq(contentQueueTable.id, id));
    return { success: true };
  });

  // Toggle account active/inactive
  app.patch('/api/accounts/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { isActive?: boolean };
    const [updated] = await db.update(platformAccounts)
      .set({ isActive: body.isActive })
      .where(eq(platformAccounts.id, id))
      .returning();
    return updated;
  });

  // Delete account
  app.delete('/api/accounts/:id', async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(platformAccounts).where(eq(platformAccounts.id, id));
    return { success: true };
  });

  // OAuth flow endpoints — start and callback
  app.get('/api/oauth/start/:platform', async (req, reply) => {
    const { platform } = req.params as { platform: string };
    const url = getOAuthUrl(platform);
    if (!url) {
      return reply.code(400).send({ error: `OAuth not configured for ${platform}. Set API keys in .env first.` });
    }
    return { url };
  });

  app.get('/api/oauth/callback/twitter', async (req, reply) => {
    const { code } = req.query as { code: string };
    try {
      const tokens = await exchangeTwitterCode(code);
      const me = await (await fetch('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
      })).json() as any;

      await db.insert(platformAccounts).values({
        platform: 'twitter',
        accountName: me.data?.username || 'twitter_user',
        credentials: { ...tokens, expiresAt: Date.now() + 7200000 },
      });
      return reply.redirect(`${env.DASHBOARD_URL}/setup?connected=twitter`);
    } catch (error) {
      return reply.redirect(`${env.DASHBOARD_URL}/setup?error=${encodeURIComponent((error as Error).message)}`);
    }
  });

  app.get('/api/oauth/callback/tiktok', async (req, reply) => {
    const { code } = req.query as { code: string };
    try {
      const tokens = await exchangeTikTokCode(code);
      await db.insert(platformAccounts).values({
        platform: 'tiktok',
        accountName: 'tiktok_user',
        credentials: { ...tokens, expiresAt: Date.now() + 86400000 },
      });
      return reply.redirect(`${env.DASHBOARD_URL}/setup?connected=tiktok`);
    } catch (error) {
      return reply.redirect(`${env.DASHBOARD_URL}/setup?error=${encodeURIComponent((error as Error).message)}`);
    }
  });

  app.get('/api/oauth/callback/instagram', async (req, reply) => {
    const { code } = req.query as { code: string };
    try {
      const tokens = await exchangeInstagramCode(code);
      await db.insert(platformAccounts).values({
        platform: 'instagram',
        accountName: 'instagram_user',
        credentials: { ...tokens, expiresAt: Date.now() + 5184000000 },
      });
      return reply.redirect(`${env.DASHBOARD_URL}/setup?connected=instagram`);
    } catch (error) {
      return reply.redirect(`${env.DASHBOARD_URL}/setup?error=${encodeURIComponent((error as Error).message)}`);
    }
  });

  app.get('/api/oauth/callback/youtube', async (req, reply) => {
    const { code } = req.query as { code: string };
    try {
      const tokens = await exchangeYouTubeCode(code);
      await db.insert(platformAccounts).values({
        platform: 'youtube',
        accountName: 'youtube_channel',
        credentials: { ...tokens, expiresAt: Date.now() + 3600000 },
      });
      return reply.redirect(`${env.DASHBOARD_URL}/setup?connected=youtube`);
    } catch (error) {
      return reply.redirect(`${env.DASHBOARD_URL}/setup?error=${encodeURIComponent((error as Error).message)}`);
    }
  });

  // List available OAuth URLs for the setup wizard
  app.get('/api/oauth/urls', async () => {
    const platforms = ['twitter', 'tiktok', 'instagram', 'youtube'];
    return platforms.map((p) => ({ platform: p, url: getOAuthUrl(p), configured: !!getOAuthUrl(p) }));
  });

  await app.listen({ port: env.ENGINE_PORT, host: '0.0.0.0' });
  console.log(`[OK] API server running on port ${env.ENGINE_PORT}`);
  console.log('');
  console.log('Social Media Bot Engine is running!');
  console.log(`  API:       http://localhost:${env.ENGINE_PORT}`);
  console.log(`  Health:    http://localhost:${env.ENGINE_PORT}/api/health`);
  console.log(`  Dashboard: ${env.DASHBOARD_URL}`);
  console.log(`  Setup:     ${env.DASHBOARD_URL}/setup`);
}

start().catch((error) => {
  console.error('Failed to start engine:', error);
  process.exit(1);
});
