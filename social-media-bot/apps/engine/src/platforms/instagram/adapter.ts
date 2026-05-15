import { BasePlatform } from '../base.js';
import { instagramClient } from './client.js';
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
} from '@smbot/shared';

export class InstagramAdapter extends BasePlatform {
  readonly name: PlatformType = 'instagram';
  readonly maxCaptionLength = 2200;
  readonly supportedContentTypes: ContentType[] = ['image', 'video', 'carousel', 'reel'];

  private async getTokens(accountId: string) {
    const [account] = await db.select().from(platformAccounts).where(eq(platformAccounts.id, accountId));
    if (!account) throw new Error(`Instagram account ${accountId} not found`);
    return account.credentials as { accessToken: string; userId: string; expiresAt: number };
  }

  async connect(credentials: Record<string, string>): Promise<void> {
    await db.insert(platformAccounts).values({
      platform: 'instagram',
      accountName: credentials.username || 'instagram_user',
      credentials: {
        accessToken: credentials.accessToken,
        userId: credentials.userId,
        expiresAt: Date.now() + 5184000000, // 60 days for long-lived tokens
      },
    });
  }

  async refreshToken(accountId: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    const result = await instagramClient.refreshLongLivedToken(tokens.accessToken);
    await db.update(platformAccounts)
      .set({
        credentials: { ...tokens, accessToken: result.accessToken, expiresAt: Date.now() + result.expiresIn * 1000 },
        lastTokenRefresh: new Date(),
      })
      .where(eq(platformAccounts.id, accountId));
  }

  async isTokenValid(accountId: string): Promise<boolean> {
    const tokens = await this.getTokens(accountId);
    return tokens.expiresAt > Date.now() + 86400000;
  }

  async publishPost(accountId: string, post: FormattedPost): Promise<PlatformPostResult> {
    try {
      const tokens = await this.getTokens(accountId);
      const caption = this.formatCaption(post);
      let containerId: string;

      if (post.contentType === 'carousel' && post.mediaUrls.length > 1) {
        const childIds: string[] = [];
        for (const url of post.mediaUrls) {
          const childId = await instagramClient.createMediaContainer(tokens, url, '');
          childIds.push(childId);
        }
        containerId = await instagramClient.createCarouselContainer(tokens, childIds, caption);
      } else if (post.contentType === 'reel' || post.contentType === 'video') {
        containerId = await instagramClient.createReelContainer(tokens, post.mediaUrls[0], caption);
      } else {
        containerId = await instagramClient.createMediaContainer(tokens, post.mediaUrls[0] || '', caption);
      }

      const mediaId = await instagramClient.publishMedia(tokens, containerId);
      return { success: true, platformPostId: mediaId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deletePost(_accountId: string, _platformPostId: string): Promise<void> {
    throw new Error('Instagram Graph API does not support deleting posts');
  }

  async fetchComments(accountId: string, platformPostId: string): Promise<PlatformComment[]> {
    const tokens = await this.getTokens(accountId);
    const comments = await instagramClient.getMediaComments(tokens, platformPostId);
    return comments.map((c) => ({
      id: c.id,
      authorName: c.username,
      authorId: c.username,
      text: c.text,
      createdAt: new Date(c.timestamp),
      likeCount: c.likeCount,
    }));
  }

  async replyToComment(accountId: string, commentId: string, text: string): Promise<void> {
    const tokens = await this.getTokens(accountId);
    await instagramClient.replyToComment(tokens, commentId, text);
  }

  async getAccountMetrics(accountId: string): Promise<AccountMetrics> {
    const tokens = await this.getTokens(accountId);
    const info = await instagramClient.getAccountInfo(tokens);
    return {
      followers: info.followersCount,
      following: info.followsCount,
      totalPosts: info.mediaCount,
    };
  }

  async getPostMetrics(accountId: string, platformPostId: string): Promise<PostMetrics> {
    const tokens = await this.getTokens(accountId);
    const insights = await instagramClient.getMediaInsights(tokens, platformPostId);
    const total = insights.likes + insights.comments + insights.shares + insights.saves;
    return {
      views: insights.impressions,
      likes: insights.likes,
      comments: insights.comments,
      shares: insights.shares,
      saves: insights.saves,
      reach: insights.reach,
      engagementRate: insights.reach > 0 ? total / insights.reach : 0,
    };
  }

  private formatCaption(post: FormattedPost): string {
    let caption = post.caption;
    if (post.hashtags.length > 0) {
      const tags = post.hashtags.slice(0, 30).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');
      caption = `${caption}\n\n${tags}`;
    }
    return caption.slice(0, 2200);
  }
}
