import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { discoverTrends, cleanupExpiredTrends } from '../../pipelines/trending/aggregator.js';

export const trendWorker = new Worker('trends', async (job) => {
  if (job.name === 'discover-trends') {
    const count = await discoverTrends();
    return { trendsDiscovered: count };
  }

  if (job.name === 'cleanup-stale') {
    const cleaned = await cleanupExpiredTrends();
    return { cleaned };
  }
}, {
  connection,
  concurrency: 1,
});

trendWorker.on('completed', (job) => {
  console.log(`[TrendWorker] Job ${job.name} completed:`, job.returnvalue);
});

trendWorker.on('failed', (job, error) => {
  console.error(`[TrendWorker] Job ${job?.name} failed:`, error.message);
});
