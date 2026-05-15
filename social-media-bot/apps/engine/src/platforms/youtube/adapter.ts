import { BasePlatform } from '../base.js';
import { youtubeClient } from './client.js';
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
  TrendingItem,
} from '@smbot/shared';

export class YouTubeAdapter extends BasePlatform {
  readonly name: PlatformType = 'youtube';
  readonly maxCaptionLength = 5000;
  readonly supportedContentTypes: ContentType[] = ['video', 'short'];

  private async getTokens(accountId: string) {
    const [account] = await db.select().from(platformAccounts).where(eq(platformAccounts.id, accountId));
    if (!account) throw new Error(`YouTube account ${accountId} not found`);
    return account.credentials as { accessToken: string; refreshToken: string; channelId: string; expiresAt: number };
  }

  async connect(credentials: Record<string, string>): Promise<void> {
    await db.insert(platformAccounts).values({
      platform: 'youtube',
      accountName: credentials.channelName || 'youtube_channel',
      credentials: {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        channelId: credentials.channelId,
        expiresAt: Date.now() + 3600000,
      },
    });
  }

  async refreshToken(accountId: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    const result = await youtubeClient.refreshAccessToken(
      env.YOUTUBE_CLIENT_ID!,
      env.YOUTUBE_CLIENT_SECRET!,
      tokens.refreshToken,
    );
    await db.update(platformAccounts)
      .set({
        credentials: { ...tokens, accessToken: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 },
        lastTokenRefresh: new Date(),
      })
      .where(eq(platformAccounts.id, accountId));
  }

  async isTokenValid(accountId: string): Promise<boolean> {
    const tokens = await this.getTokens(accountId);
    return tokens.expiresAt > Date.now() + 300000;
  }

  async publishPost(_accountId: string, _post: FormattedPost): Promise<PlatformPostResult> {
    // YouTube video upload requires multipart upload with the actual video file.
    // This would use the resumable upload flow from the YouTube Data API.
    // For now, return a placeholder — video upload integration requires
    // a separate media storage pipeline.
    return { success: false, error: 'YouTube video upload requires media pipeline integration' };
  }

  async deletePost(_accountId: string, _platformPostId: string): Promise<void> {
    throw new Error('YouTube video deletion not implemented');
  }

  async fetchComments(accountId: string, platformPostId: string): Promise<PlatformComment[]> {
    const tokens = await this.getTokens(accountId);
    const result = await youtubeClient.getVideoComments(tokens, platformPostId);
    return result.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorId: c.authorChannelId,
      text: c.text,
      createdAt: new Date(c.publishedAt),
      likeCount: c.likeCount,
    }));
  }

  async replyToComment(accountId: string, commentId: string, text: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    await youtubeClient.replyToComment(tokens, commentId, text);
  }

  async getAccountMetrics(accountId: string): Promise<AccountMetrics> {
    const tokens = await this.getTokens(accountId);
    const stats = await youtubeClient.getChannelStats(tokens);
    return {
      followers: stats.subscriberCount,
      following: 0,
      totalPosts: stats.videoCount,
    };
  }

  async getPostMetrics(accountId: string, platformPostId: string): Promise<PostMetrics> {
    const tokens = await this.getTokens(accountId);
    const stats = await youtubeClient.getVideoStats(tokens, platformPostId);
    const total = stats.likeCount + stats.commentCount;
    return {
      views: stats.viewCount,
      likes: stats.likeCount,
      comments: stats.commentCount,
      shares: 0,
      saves: 0,
      reach: stats.viewCount,
      engagementRate: stats.viewCount > 0 ? total / stats.viewCount : 0,
    };
  }

  async fetchTrending(): Promise<TrendingItem[]> {
    const trending = await youtubeClient.getTrending();
    const tagCounts = new Map<string, number>();
    for (const video of trending) {
      for (const tag of video.tags) {
        tagCounts.set(tag.toLowerCase(), (tagCounts.get(tag.toLowerCase()) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({
        topic: tag,
        hashtags: [`#${tag.replace(/\s+/g, '')}`],
        volume: count,
        velocity: 0,
        source: 'youtube_trending' as const,
      }));
  }
}
