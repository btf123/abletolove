import { env } from '../../config/env.js';

interface TwitterTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class TwitterClient {
  private baseUrl = 'https://api.twitter.com/2';

  async postTweet(tokens: TwitterTokens, text: string): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter API error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { id: string } };
    return { id: data.data.id };
  }

  async deleteTweet(tokens: TwitterTokens, tweetId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tweets/${tweetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter delete error ${response.status}: ${error}`);
    }
  }

  async getMe(tokens: TwitterTokens): Promise<{ id: string; username: string; publicMetrics: { followersCount: number; followingCount: number; tweetCount: number } }> {
    const response = await fetch(`${this.baseUrl}/users/me?user.fields=public_metrics`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter getMe error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      id: data.data.id,
      username: data.data.username,
      publicMetrics: {
        followersCount: data.data.public_metrics.followers_count,
        followingCount: data.data.public_metrics.following_count,
        tweetCount: data.data.public_metrics.tweet_count,
      },
    };
  }

  async getTweetMetrics(tokens: TwitterTokens, tweetId: string): Promise<{ views: number; likes: number; replies: number; retweets: number; impressions: number }> {
    const response = await fetch(`${this.baseUrl}/tweets/${tweetId}?tweet.fields=public_metrics,organic_metrics`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter metrics error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    const metrics = data.data.public_metrics;
    return {
      views: metrics.impression_count || 0,
      likes: metrics.like_count || 0,
      replies: metrics.reply_count || 0,
      retweets: metrics.retweet_count || 0,
      impressions: metrics.impression_count || 0,
    };
  }

  async getReplies(tokens: TwitterTokens, tweetId: string, sinceId?: string): Promise<Array<{ id: string; authorId: string; authorName: string; text: string; createdAt: string; likeCount: number }>> {
    let url = `${this.baseUrl}/tweets/search/recent?query=conversation_id:${tweetId}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`;
    if (sinceId) url += `&since_id=${sinceId}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${env.TWITTER_BEARER_TOKEN || tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter replies error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    if (!data.data) return [];

    const users = new Map((data.includes?.users || []).map((u: any) => [u.id, u.username]));

    return data.data.map((tweet: any) => ({
      id: tweet.id,
      authorId: tweet.author_id,
      authorName: users.get(tweet.author_id) || 'unknown',
      text: tweet.text,
      createdAt: tweet.created_at,
      likeCount: tweet.public_metrics?.like_count || 0,
    }));
  }

  async replyToTweet(tokens: TwitterTokens, tweetId: string, text: string): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter reply error ${response.status}: ${error}`);
    }

    const data = await response.json() as { data: { id: string } };
    return { id: data.data.id };
  }

  async getTrending(woeid: number = 1): Promise<Array<{ name: string; tweetVolume: number | null }>> {
    const response = await fetch(`${this.baseUrl}/trends/by/woeid/${woeid}`, {
      headers: { 'Authorization': `Bearer ${env.TWITTER_BEARER_TOKEN}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter trends error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return (data.data || []).map((trend: any) => ({
      name: trend.trend_name || trend.name,
      tweetVolume: trend.tweet_count || null,
    }));
  }

  async refreshAccessToken(refreshToken: string): Promise<TwitterTokens> {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${env.TWITTER_API_KEY}:${env.TWITTER_API_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}

export const twitterClient = new TwitterClient();
