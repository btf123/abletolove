import { BasePlatform } from '../base.js';
import { tiktokClient } from './client.js';
import { db } from '../../db/client.js';
import { platformAccounts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import type {
  PlatformType,
  ContentType,
  FormattedPost,
  PlatformPostResult,
  PlatformComment,
  AccountMetrics,
  PostMetrics,
} from '@smbot/shared';

export class TikTokAdapter extends BasePlatform {
  readonly name: PlatformType = 'tiktok';
  readonly maxCaptionLength = 2200;
  readonly supportedContentTypes: ContentType[] = ['video', 'short'];

  private async getTokens(accountId: string) {
    const [account] = await db.select().from(platformAccounts).where(eq(platformAccounts.id, accountId));
    if (!account) throw new Error(`TikTok account ${accountId} not found`);
    return account.credentials as { accessToken: string; refreshToken: string; openId: string; expiresAt: number };
  }

  async connect(credentials: Record<string, string>): Promise<void> {
    await db.insert(platformAccounts).values({
      platform: 'tiktok',
      accountName: credentials.username || 'tiktok_user',
      credentials: {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        openId: credentials.openId,
        expiresAt: Date.now() + 86400000,
      },
    });
  }

  async refreshToken(accountId: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    const newTokens = await tiktokClient.refreshAccessToken(
      env.TIKTOK_CLIENT_KEY!,
      env.TIKTOK_CLIENT_SECRET!,
      tokens.refreshToken,
    );
    await db.update(platformAccounts)
      .set({ credentials: newTokens, lastTokenRefresh: new Date() })
      .where(eq(platformAccounts.id, accountId));
  }

  async isTokenValid(accountId: string): Promise<boolean> {
    const tokens = await this.getTokens(accountId);
    return tokens.expiresAt > Date.now() + 300000;
  }

  async publishPost(accountId: string, post: FormattedPost): Promise<PlatformPostResult> {
    try {
      const tokens = await this.getTokens(accountId);
      if (!post.mediaUrls.length) {
        return { success: false, error: 'TikTok requires a video URL' };
      }
      const caption = this.formatCaption(post);
      const result = await tiktokClient.publishVideo(tokens, post.mediaUrls[0], caption);
      return { success: true, platformPostId: result.publishId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deletePost(_accountId: string, _platformPostId: string): Promise<void> {
    throw new Error('TikTok API does not support deleting posts programmatically');
  }

  async fetchComments(accountId: string, platformPostId: string): Promise<PlatformComment[]> {
    const tokens = await this.getTokens(accountId);
    const result = await tiktokClient.getVideoComments(tokens, platformPostId);
    return result.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorId: '',
      text: c.text,
      createdAt: new Date(c.createTime * 1000),
      likeCount: c.likeCount,
    }));
  }

  async replyToComment(accountId: string, commentId: string, text: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    // commentId format: "videoId:commentId"
    const [videoId, actualCommentId] = commentId.split(':');
    await tiktokClient.replyToComment(tokens, videoId, actualCommentId, text);
  }

  async getAccountMetrics(accountId: string): Promise<AccountMetrics> {
    const tokens = await this.getTokens(accountId);
    const info = await tiktokClient.getUserInfo(tokens);
    return {
      followers: info.followerCount,
      following: info.followingCount,
      totalPosts: info.videoCount,
    };
  }

  async getPostMetrics(_accountId: string, _platformPostId: string): Promise<PostMetrics> {
    return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, engagementRate: 0 };
  }

  private formatCaption(post: FormattedPost): string {
    let caption = post.caption;
    if (post.hashtags.length > 0) {
      const tags = post.hashtags.slice(0, 8).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
      caption = `${caption}\n\n${tags}`;
    }
    return caption.slice(0, 2200);
  }
}
