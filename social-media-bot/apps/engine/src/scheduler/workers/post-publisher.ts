import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { db } from '../../db/client.js';
import { scheduledPosts, contentQueue } from '../../db/schema.js';
import { getPlatform } from '../../platforms/registry.js';
import { eq, and, lte, inArray } from 'drizzle-orm';
import type { PlatformType, ContentType } from '@smbot/shared';

export const publisherWorker = new Worker('publishing', async (job) => {
  if (job.name !== 'publish-posts') return;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

  const duePosts = await db.select()
    .from(scheduledPosts)
    .innerJoin(contentQueue, eq(scheduledPosts.contentId, contentQueue.id))
    .where(
      and(
        eq(scheduledPosts.status, 'pending'),
        lte(scheduledPosts.scheduledFor, windowEnd),
        // Never publish content a human hasn't approved: drafts and failed
        // content are excluded even if a scheduled row exists for them.
        inArray(contentQueue.status, ['approved', 'scheduled', 'publishing', 'published']),
      ),
    );

  let published = 0;
  let failed = 0;

  for (const row of duePosts) {
    const post = row.scheduled_posts;
    const content = row.content_queue;

    try {
      await db.update(scheduledPosts)
        .set({ status: 'publishing' })
        .where(eq(scheduledPosts.id, post.id));

      const platform = getPlatform(post.platform as PlatformType);
      const result = await platform.publishPost(post.accountId, {
        caption: content.caption,
        hashtags: content.hashtags || [],
        mediaUrls: content.mediaUrls || [],
        contentType: content.contentType as ContentType,
      });

      if (result.success) {
        await db.update(scheduledPosts)
          .set({
            status: 'published',
            publishedAt: new Date(),
            platformPostId: result.platformPostId,
          })
          .where(eq(scheduledPosts.id, post.id));

        await db.update(contentQueue)
          .set({ status: 'published' })
          .where(eq(contentQueue.id, content.id));

        published++;
      } else {
        const retryCount = (post.retryCount || 0) + 1;
        await db.update(scheduledPosts)
          .set({
            status: retryCount >= 3 ? 'failed' : 'pending',
            errorMessage: result.error,
            retryCount,
            scheduledFor: retryCount < 3 ? new Date(now.getTime() + retryCount * 15 * 60 * 1000) : post.scheduledFor,
          })
          .where(eq(scheduledPosts.id, post.id));
        failed++;
      }
    } catch (error) {
      await db.update(scheduledPosts)
        .set({ status: 'failed', errorMessage: error instanceof Error ? error.message : 'Unknown error' })
        .where(eq(scheduledPosts.id, post.id));
      failed++;
    }
  }

  return { published, failed, total: duePosts.length };
}, {
  connection,
  concurrency: 1,
});

publisherWorker.on('completed', (job) => {
  if (job.returnvalue?.total > 0) {
    console.log(`[Publisher] Published ${job.returnvalue.published}/${job.returnvalue.total} posts`);
  }
});

publisherWorker.on('failed', (job, error) => {
  console.error(`[Publisher] Job failed:`, error.message);
});
