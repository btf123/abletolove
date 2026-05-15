import { db } from '../../db/client.js';
import { scheduledPosts, platformAccounts } from '../../db/schema.js';
import { getPlatform } from '../../platforms/registry.js';
import { eq, and, gt, isNotNull } from 'drizzle-orm';
import type { PlatformComment, PlatformType } from '@smbot/shared';

export interface FetchedComment extends PlatformComment {
  postId: string;
  platform: PlatformType;
  platformPostId: string;
}

export async function fetchNewComments(): Promise<FetchedComment[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentPosts = await db.select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, 'published'),
        gt(scheduledPosts.publishedAt!, sevenDaysAgo),
        isNotNull(scheduledPosts.platformPostId),
      ),
    );

  const allComments: FetchedComment[] = [];

  for (const post of recentPosts) {
    try {
      const platform = getPlatform(post.platform as PlatformType);
      const comments = await platform.fetchComments(post.accountId, post.platformPostId!);

      for (const comment of comments) {
        allComments.push({
          ...comment,
          postId: post.id,
          platform: post.platform as PlatformType,
          platformPostId: post.platformPostId!,
        });
      }
    } catch (error) {
      console.error(`[Engagement] Failed to fetch comments for post ${post.id}:`, error);
    }
  }

  return allComments;
}
