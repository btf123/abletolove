import { BasePlatform } from '../base.js';
import { twitterClient } from './client.js';
import { db } from '../../db/client.js';
import { platformAccounts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
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

export class TwitterAdapter extends BasePlatform {
  readonly name: PlatformType = 'twitter';
  readonly maxCaptionLength = 280;
  readonly supportedContentTypes: ContentType[] = ['text', 'image', 'video'];

  private async getTokens(accountId: string) {
    const [account] = await db.select().from(platformAccounts).where(eq(platformAccounts.id, accountId));
    if (!account) throw new Error(`Twitter account ${accountId} not found`);
    return account.credentials as { accessToken: string; refreshToken: string; expiresAt: number };
  }

  async connect(credentials: Record<string, string>): Promise<void> {
    await db.insert(platformAccounts).values({
      platform: 'twitter',
      accountName: credentials.username || 'twitter_user',
      credentials: {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: Date.now() + 7200000,
      },
    });
  }

  async refreshToken(accountId: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    const newTokens = await twitterClient.refreshAccessToken(tokens.refreshToken);
    await db.update(platformAccounts)
      .set({
        credentials: newTokens,
        lastTokenRefresh: new Date(),
      })
      .where(eq(platformAccounts.id, accountId));
  }

  async isTokenValid(accountId: string): Promise<boolean> {
    const tokens = await this.getTokens(accountId);
    return tokens.expiresAt > Date.now() + 300000;
  }

  async publishPost(accountId: string, post: FormattedPost): Promise<PlatformPostResult> {
    try {
      const tokens = await this.getTokens(accountId);
      const text = this.formatTweet(post);
      const result = await twitterClient.postTweet(tokens, text);
      return { success: true, platformPostId: result.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deletePost(accountId: string, platformPostId: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    await twitterClient.deleteTweet(tokens, platformPostId);
  }

  async fetchComments(accountId: string, platformPostId: string, since?: Date): Promise<PlatformComment[]> {
    const tokens = await this.getTokens(accountId);
    const replies = await twitterClient.getReplies(tokens, platformPostId);
    return replies.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorId: r.authorId,
      text: r.text,
      createdAt: new Date(r.createdAt),
      likeCount: r.likeCount,
    }));
  }

  async replyToComment(accountId: string, commentId: string, text: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    await twitterClient.replyToTweet(tokens, commentId, text);
  }

  async getAccountMetrics(accountId: string): Promise<AccountMetrics> {
    const tokens = await this.getTokens(accountId);
    const me = await twitterClient.getMe(tokens);
    return {
      followers: me.publicMetrics.followersCount,
      following: me.publicMetrics.followingCount,
      totalPosts: me.publicMetrics.tweetCount,
    };
  }

  async getPostMetrics(accountId: string, platformPostId: string): Promise<PostMetrics> {
    const tokens = await this.getTokens(accountId);
    const metrics = await twitterClient.getTweetMetrics(tokens, platformPostId);
    const total = metrics.likes + metrics.replies + metrics.retweets;
    return {
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.replies,
      shares: metrics.retweets,
      saves: 0,
      reach: metrics.impressions,
      engagementRate: metrics.views > 0 ? total / metrics.views : 0,
    };
  }

  async fetchTrending(): Promise<TrendingItem[]> {
    const trends = await twitterClient.getTrending();
    return trends.map((t) => ({
      topic: t.name,
      hashtags: t.name.startsWith('#') ? [t.name] : [],
      volume: t.tweetVolume || 0,
      velocity: 0,
      source: 'twitter_trending' as const,
    }));
  }

  private formatTweet(post: FormattedPost): string {
    let tweet = post.caption;
    if (post.hashtags.length > 0) {
      const tags = post.hashtags.slice(0, 3).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
      const withTags = `${tweet}\n\n${tags}`;
      if (withTags.length <= 280) tweet = withTags;
    }
    return tweet.slice(0, 280);
  }
}
