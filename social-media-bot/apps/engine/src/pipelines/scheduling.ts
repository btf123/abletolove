import { db } from '../db/client.js';
import { contentQueue, scheduledPosts, platformAccounts, systemConfig } from '../db/schema.js';
import { DEFAULT_POSTING_WINDOWS } from '@smbot/shared';
import { eq } from 'drizzle-orm';
import type { PlatformType } from '@smbot/shared';

/**
 * Create scheduled_posts rows for a piece of approved content, one per
 * target platform that has an active account connected.
 *
 * Campaign posts carry a planned publish time (stored in the
 * campaign_planned_times config map by the seeder); everything else is
 * slotted into the platform's next optimal posting window. A planned time
 * that has already passed (content approved late) publishes at the next
 * publisher run instead of being dropped.
 */
export async function scheduleApprovedContent(contentId: string): Promise<number> {
  const [content] = await db.select().from(contentQueue).where(eq(contentQueue.id, contentId));
  if (!content) return 0;

  const existing = await db.select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(eq(scheduledPosts.contentId, contentId));
  if (existing.length > 0) return 0;

  const accounts = await db.select({ id: platformAccounts.id, platform: platformAccounts.platform })
    .from(platformAccounts)
    .where(eq(platformAccounts.isActive, true));

  const [plannedConfig] = await db.select()
    .from(systemConfig)
    .where(eq(systemConfig.key, 'campaign_planned_times'));
  const plannedTimes = (plannedConfig?.value as Record<string, string>) || {};
  const planned = plannedTimes[contentId] ? new Date(plannedTimes[contentId]) : null;

  let created = 0;
  for (const platform of (content.targetPlatforms || []) as PlatformType[]) {
    const account = accounts.find((a) => a.platform === platform);
    if (!account) {
      console.warn(`[Scheduling] No active ${platform} account for content ${contentId}, skipping`);
      continue;
    }

    let scheduledFor = planned || nextOptimalTime(platform);
    const soonest = new Date(Date.now() + 5 * 60 * 1000);
    if (scheduledFor < soonest) scheduledFor = soonest;

    await db.insert(scheduledPosts).values({
      contentId,
      platform,
      accountId: account.id,
      scheduledFor,
    });
    created++;
  }

  if (created > 0) {
    await db.update(contentQueue)
      .set({ status: 'scheduled' })
      .where(eq(contentQueue.id, contentId));
  }
  return created;
}

function nextOptimalTime(platform: PlatformType): Date {
  const windows = DEFAULT_POSTING_WINDOWS.find((w) => w.platform === platform);
  const hours = [...(windows?.hours || [12])].sort((a, b) => a - b);
  const now = new Date();

  const candidate = new Date(now);
  const nextHour = hours.find((h) => h > now.getHours());
  if (nextHour !== undefined) {
    candidate.setHours(nextHour, Math.floor(Math.random() * 15), 0, 0);
  } else {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hours[0], Math.floor(Math.random() * 15), 0, 0);
  }
  return candidate;
}
