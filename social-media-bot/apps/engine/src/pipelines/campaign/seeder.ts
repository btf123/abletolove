import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../db/client.js';
import { contentQueue, systemConfig } from '../../db/schema.js';
import type { ContentType } from '@smbot/shared';

interface CampaignPost {
  day: number;
  hour: number;
  targetPlatforms: string[];
  contentType: string;
  caption: string;
  hashtags: string[];
  mediaRequired?: boolean;
}

interface CampaignFile {
  name: string;
  repeat?: 'yearly' | 'none';
  posts: CampaignPost[];
}

const RESEED_AFTER_DAYS = 360;

async function getConfigMap(): Promise<Record<string, any>> {
  const configs = await db.select().from(systemConfig);
  return Object.fromEntries(configs.map((c) => [c.key, c.value]));
}

async function setConfig(key: string, value: any): Promise<void> {
  await db.insert(systemConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: new Date() } });
}

/**
 * Seed the launch campaign into the content queue as DRAFTS awaiting human
 * approval. Each post's intended publish time is recorded in the
 * campaign_planned_times config map; approval (dashboard or API) turns the
 * draft into a scheduled post at that time.
 *
 * Re-seeding is self-gating: without force, the campaign only seeds again
 * once RESEED_AFTER_DAYS have passed since the last seed AND the campaign
 * (or campaign_repeat config) asks for a yearly repeat. The daily cron can
 * therefore call this unconditionally.
 */
export async function seedCampaign(options: { force?: boolean } = {}): Promise<{ seeded: number; skipped: boolean }> {
  const campaignPath = process.env.CAMPAIGN_FILE
    || path.resolve(process.cwd(), '../../config/abletolove.campaign.json');

  let campaign: CampaignFile;
  try {
    campaign = JSON.parse(await readFile(campaignPath, 'utf8'));
  } catch (error) {
    console.warn(`[Campaign] No campaign file at ${campaignPath}, skipping:`, (error as Error).message);
    return { seeded: 0, skipped: true };
  }

  const config = await getConfigMap();

  if (!options.force) {
    const lastSeededAt = config.campaign_last_seeded_at ? new Date(config.campaign_last_seeded_at as string) : null;
    if (!lastSeededAt) {
      // Never seeded: only the explicit setup run (force) does the first seed,
      // so the cron can't surprise-fill the queue before setup is complete.
      return { seeded: 0, skipped: true };
    }
    const repeat = (config.campaign_repeat as string) || campaign.repeat || 'none';
    const ageDays = (Date.now() - lastSeededAt.getTime()) / 86400000;
    if (repeat !== 'yearly' || ageDays < RESEED_AFTER_DAYS) {
      return { seeded: 0, skipped: true };
    }
  }

  const link = (config.campaign_link as string) || 'able2love.app';
  const startDateRaw = config.campaign_start_date as string | undefined;
  let start = startDateRaw ? new Date(startDateRaw) : new Date();
  if (Number.isNaN(start.getTime()) || start < new Date()) {
    start = new Date();
    start.setDate(start.getDate() + 1); // default: campaign starts tomorrow
  }
  start.setHours(0, 0, 0, 0);

  console.log(`[Campaign] Seeding "${campaign.name}" (${campaign.posts.length} posts) starting ${start.toDateString()}`);

  const plannedTimes: Record<string, string> = { ...((config.campaign_planned_times as Record<string, string>) || {}) };
  let seeded = 0;

  for (const post of campaign.posts) {
    const caption = post.caption.replaceAll('{{LINK}}', link);
    const publishAt = new Date(start);
    publishAt.setDate(publishAt.getDate() + (post.day - 1));
    publishAt.setHours(post.hour, 0, 0, 0);

    const [inserted] = await db.insert(contentQueue).values({
      status: 'draft',
      contentType: post.contentType as ContentType,
      caption: post.mediaRequired
        ? `${caption}\n\n[⚠ attach media before approving — this platform needs an image/video]`
        : caption,
      hashtags: post.hashtags,
      mediaUrls: [],
      targetPlatforms: post.targetPlatforms,
    }).returning();

    if (inserted) {
      plannedTimes[inserted.id] = publishAt.toISOString();
      seeded++;
    }
  }

  await setConfig('campaign_planned_times', plannedTimes);
  await setConfig('campaign_last_seeded_at', new Date().toISOString());

  console.log(`[Campaign] Seeded ${seeded} posts as drafts — approve them in the dashboard Content queue`);
  return { seeded, skipped: false };
}
