import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { seedCampaign } from '../../pipelines/campaign/seeder.js';

// Runs daily; seedCampaign self-gates, so it only actually re-seeds once a
// year (campaign_repeat = 'yearly') after the previous run has aged out.
export const campaignWorker = new Worker('campaign', async (job) => {
  if (job.name === 'seed-campaign') {
    return await seedCampaign();
  }
}, {
  connection,
  concurrency: 1,
});

campaignWorker.on('completed', (job) => {
  if (job.returnvalue && !job.returnvalue.skipped) {
    console.log(`[CampaignWorker] Seeded ${job.returnvalue.seeded} campaign posts for approval`);
  }
});

campaignWorker.on('failed', (job, error) => {
  console.error(`[CampaignWorker] Job ${job?.name} failed:`, error.message);
});
