import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { processComments } from '../../pipelines/engagement/responder.js';

export const engagementWorker = new Worker('engagement', async (job) => {
  if (job.name === 'process-comments') {
    return await processComments();
  }
}, {
  connection,
  concurrency: 1,
});

engagementWorker.on('completed', (job) => {
  console.log(`[EngagementWorker] Job completed:`, job.returnvalue);
});

engagementWorker.on('failed', (job, error) => {
  console.error(`[EngagementWorker] Job ${job?.name} failed:`, error.message);
});
