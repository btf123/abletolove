import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { collectAnalytics, refreshAllTokens } from '../../analytics/collector.js';

export const analyticsWorker = new Worker('analytics', async (job) => {
  if (job.name === 'collect-analytics') {
    return await collectAnalytics();
  }

  if (job.name === 'refresh-tokens') {
    return await refreshAllTokens();
  }
}, {
  connection,
  concurrency: 1,
});

analyticsWorker.on('completed', (job) => {
  console.log(`[AnalyticsWorker] Job ${job.name} completed:`, job.returnvalue);
});

analyticsWorker.on('failed', (job, error) => {
  console.error(`[AnalyticsWorker] Job ${job?.name} failed:`, error.message);
});
