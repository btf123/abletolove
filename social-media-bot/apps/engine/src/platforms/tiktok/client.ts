interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresAt: number;
}

export class TikTokClient {
  private baseUrl = 'https://open.tiktokapis.com/v2';

  async publishVideo(tokens: TikTokTokens, videoUrl: string, caption: string): Promise<{ publishId: string }> {
    const initResponse = await fetch(`${this.baseUrl}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`TikTok publish init error ${initResponse.status}: ${error}`);
    }

    const data = await initResponse.json() as any;
    return { publishId: data.data.publish_id };
  }

  async checkPublishStatus(tokens: TikTokTokens, publishId: string): Promise<{ status: string; publiclyAvailablePostId?: string }> {
    const response = await fetch(`${this.baseUrl}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok status error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      status: data.data.status,
      publiclyAvailablePostId: data.data.publicaly_available_post_id?.[0],
    };
  }

  async getUserInfo(tokens: TikTokTokens): Promise<{ displayName: string; followerCount: number; followingCount: number; videoCount: number }> {
    const response = await fetch(`${this.baseUrl}/user/info/?fields=display_name,follower_count,following_count,video_count`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok user info error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      displayName: data.data.user.display_name,
      followerCount: data.data.user.follower_count,
      followingCount: data.data.user.following_count,
      videoCount: data.data.user.video_count,
    };
  }

  async getVideoComments(tokens: TikTokTokens, videoId: string, cursor?: number): Promise<{ comments: Array<{ id: string; text: string; authorName: string; createTime: number; likeCount: number }>; cursor: number; hasMore: boolean }> {
    let url = `${this.baseUrl}/comment/list/?fields=id,text,create_time,like_count,user&video_id=${videoId}&max_count=50`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok comments error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      comments: (data.data.comments || []).map((c: any) => ({
        id: c.id,
        text: c.text,
        authorName: c.user?.display_name || 'unknown',
        createTime: c.create_time,
        likeCount: c.like_count || 0,
      })),
      cursor: data.data.cursor || 0,
      hasMore: data.data.has_more || false,
    };
  }

  async replyToComment(tokens: TikTokTokens, videoId: string, commentId: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/comment/reply/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        comment_id: commentId,
        text: text.slice(0, 150),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok reply error ${response.status}: ${error}`);
    }
  }

  async refreshAccessToken(clientKey: string, clientSecret: string, refreshToken: string): Promise<TikTokTokens> {
    const response = await fetch(`${this.baseUrl}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok token refresh error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      openId: data.open_id,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}

export const tiktokClient = new TikTokClient();
