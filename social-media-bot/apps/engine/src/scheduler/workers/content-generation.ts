import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { generateContent } from '../../pipelines/content/generator.js';

export const contentWorker = new Worker('content', async (job) => {
  if (job.name === 'generate-content') {
    const count = await generateContent();
    return { contentGenerated: count };
  }
}, {
  connection,
  concurrency: 1,
});

contentWorker.on('completed', (job) => {
  console.log(`[ContentWorker] Job ${job.name} completed:`, job.returnvalue);
});

contentWorker.on('failed', (job, error) => {
  console.error(`[ContentWorker] Job ${job?.name} failed:`, error.message);
});
