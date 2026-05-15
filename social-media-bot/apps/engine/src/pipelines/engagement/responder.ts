import { db } from '../../db/client.js';
import { engagementReplies, contentQueue, scheduledPosts } from '../../db/schema.js';
import { getPlatform } from '../../platforms/registry.js';
import { fetchNewComments } from './comment-fetcher.js';
import { generateReply } from './reply-generator.js';
import { checkReplySafety } from './safety.js';
import { ENGAGEMENT_LIMITS } from '@smbot/shared';
import { eq, and, sql } from 'drizzle-orm';
import type { PlatformType } from '@smbot/shared';

function shouldReplyToComment(text: string): boolean {
  if (text.length < ENGAGEMENT_LIMITS.COMMENT_MIN_LENGTH) return false;

  const emojiOnly = /^[\p{Emoji}\s]+$/u;
  if (emojiOnly.test(text)) return false;

  const singleWords = ['nice', 'wow', 'cool', 'great', 'amazing', 'fire', 'love', 'yes', 'no', 'ok', 'lol', 'lmao'];
  if (singleWords.includes(text.toLowerCase().trim())) return false;

  return true;
}

export async function processComments(): Promise<{ replied: number; flagged: number; skipped: number }> {
  console.log('[Engagement] Starting comment processing...');

  const comments = await fetchNewComments();
  console.log(`[Engagement] Found ${comments.length} comments to process`);

  let replied = 0;
  let flagged = 0;
  let skipped = 0;

  const replyCounts = new Map<string, number>();

  for (const comment of comments) {
    if (replied >= ENGAGEMENT_LIMITS.MAX_TOTAL_REPLIES_PER_HOUR) {
      console.log('[Engagement] Hit hourly reply limit');
      break;
    }

    const postReplies = replyCounts.get(comment.postId) || 0;
    if (postReplies >= ENGAGEMENT_LIMITS.MAX_REPLIES_PER_POST_PER_HOUR) {
      skipped++;
      continue;
    }

    if (!shouldReplyToComment(comment.text)) {
      skipped++;
      continue;
    }

    // Check if we already replied to this comment
    const [existing] = await db.select()
      .from(engagementReplies)
      .where(eq(engagementReplies.platformCommentId, comment.id))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    try {
      // Get the original post caption for context
      const [post] = await db.select({ caption: contentQueue.caption })
        .from(scheduledPosts)
        .innerJoin(contentQueue, eq(scheduledPosts.contentId, contentQueue.id))
        .where(eq(scheduledPosts.id, comment.postId));

      const postCaption = post?.caption || '';
      const replyText = await generateReply(postCaption, comment.text);

      const safety = await checkReplySafety(replyText);

      if (!safety.safe) {
        await db.insert(engagementReplies).values({
          platform: comment.platform,
          postId: comment.postId,
          platformCommentId: comment.id,
          commentText: comment.text,
          replyText,
          replyStatus: 'flagged',
          flaggedReason: safety.reason,
        });
        flagged++;
        continue;
      }

      // Post the reply
      const platform = getPlatform(comment.platform);
      const commentRef = comment.platform === 'tiktok'
        ? `${comment.platformPostId}:${comment.id}`
        : comment.id;

      const [scheduledPost] = await db.select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, comment.postId));

      await platform.replyToComment(scheduledPost.accountId, commentRef, replyText);

      await db.insert(engagementReplies).values({
        platform: comment.platform,
        postId: comment.postId,
        platformCommentId: comment.id,
        commentText: comment.text,
        replyText,
        replyStatus: 'sent',
        repliedAt: new Date(),
      });

      replyCounts.set(comment.postId, postReplies + 1);
      replied++;
    } catch (error) {
      console.error(`[Engagement] Reply failed for comment ${comment.id}:`, error);
      await db.insert(engagementReplies).values({
        platform: comment.platform,
        postId: comment.postId,
        platformCommentId: comment.id,
        commentText: comment.text,
        replyText: '',
        replyStatus: 'failed',
      });
    }
  }

  console.log(`[Engagement] Done: ${replied} replied, ${flagged} flagged, ${skipped} skipped`);
  return { replied, flagged, skipped };
}
