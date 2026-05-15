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
import { eq, desc, gt, and } from 'drizzle-orm';

// Import workers to start them
import './scheduler/workers/trend-discovery.js';
import './scheduler/workers/content-generation.js';
import './scheduler/workers/post-publisher.js';
import './scheduler/workers/comment-responder.js';
import './scheduler/workers/analytics-collector.js';

async function start() {
  console.log('🚀 Social Media Bot Engine starting...');

  // Register platform adapters
  registerPlatform(new TwitterAdapter());
  registerPlatform(new TikTokAdapter());
  registerPlatform(new InstagramAdapter());
  registerPlatform(new YouTubeAdapter());
  console.log('✓ Platform adapters registered');

  // Register cron jobs
  await registerCronJobs();
  console.log('✓ Cron jobs registered');

  // Start REST API for dashboard
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: env.DASHBOARD_URL });

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

  await app.listen({ port: env.ENGINE_PORT, host: '0.0.0.0' });
  console.log(`✓ API server running on port ${env.ENGINE_PORT}`);
  console.log('');
  console.log('🤖 Social Media Bot Engine is running!');
  console.log('   Dashboard API: http://localhost:' + env.ENGINE_PORT);
  console.log('   Cron jobs active and scheduling posts automatically.');
}

start().catch((error) => {
  console.error('Failed to start engine:', error);
  process.exit(1);
});
