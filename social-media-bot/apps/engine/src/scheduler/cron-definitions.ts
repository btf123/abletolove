import { CRON_SCHEDULES } from '@smbot/shared';
import { trendsQueue, contentQueue, publishingQueue, engagementQueue, analyticsQueue, campaignQueue } from './queue.js';

export async function registerCronJobs(): Promise<void> {
  console.log('[Scheduler] Registering cron jobs...');

  await trendsQueue.upsertJobScheduler('trend-discovery', {
    pattern: CRON_SCHEDULES.TREND_DISCOVERY,
  }, { name: 'discover-trends' });

  await contentQueue.upsertJobScheduler('content-generation', {
    pattern: CRON_SCHEDULES.CONTENT_GENERATION,
  }, { name: 'generate-content' });

  await publishingQueue.upsertJobScheduler('post-publisher', {
    pattern: CRON_SCHEDULES.POST_PUBLISHER,
  }, { name: 'publish-posts' });

  await engagementQueue.upsertJobScheduler('comment-responder', {
    pattern: CRON_SCHEDULES.COMMENT_RESPONDER,
  }, { name: 'process-comments' });

  await analyticsQueue.upsertJobScheduler('analytics-collector', {
    pattern: CRON_SCHEDULES.ANALYTICS_COLLECTOR,
  }, { name: 'collect-analytics' });

  await analyticsQueue.upsertJobScheduler('token-refresher', {
    pattern: CRON_SCHEDULES.TOKEN_REFRESHER,
  }, { name: 'refresh-tokens' });

  await trendsQueue.upsertJobScheduler('stale-cleanup', {
    pattern: CRON_SCHEDULES.STALE_CLEANUP,
  }, { name: 'cleanup-stale' });

  await campaignQueue.upsertJobScheduler('campaign-seeder', {
    pattern: CRON_SCHEDULES.CAMPAIGN_SEEDER,
  }, { name: 'seed-campaign' });

  console.log('[Scheduler] All cron jobs registered');
}
