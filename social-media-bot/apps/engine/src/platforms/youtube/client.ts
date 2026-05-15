interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  channelId: string;
  expiresAt: number;
}

export class YouTubeClient {
  private apiUrl = 'https://www.googleapis.com/youtube/v3';

  async getChannelStats(tokens: YouTubeTokens): Promise<{ subscriberCount: number; videoCount: number; viewCount: number }> {
    const response = await fetch(
      `${this.apiUrl}/channels?part=statistics&id=${tokens.channelId}&key=&access_token=${tokens.accessToken}`,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube channel stats error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    const stats = data.items?.[0]?.statistics;
    return {
      subscriberCount: parseInt(stats?.subscriberCount || '0'),
      videoCount: parseInt(stats?.videoCount || '0'),
      viewCount: parseInt(stats?.viewCount || '0'),
    };
  }

  async getVideoStats(tokens: YouTubeTokens, videoId: string): Promise<{ viewCount: number; likeCount: number; commentCount: number }> {
    const response = await fetch(
      `${this.apiUrl}/videos?part=statistics&id=${videoId}`,
      { headers: { 'Authorization': `Bearer ${tokens.accessToken}` } },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube video stats error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    const stats = data.items?.[0]?.statistics;
    return {
      viewCount: parseInt(stats?.viewCount || '0'),
      likeCount: parseInt(stats?.likeCount || '0'),
      commentCount: parseInt(stats?.commentCount || '0'),
    };
  }

  async getVideoComments(tokens: YouTubeTokens, videoId: string, pageToken?: string): Promise<{ comments: Array<{ id: string; authorName: string; authorChannelId: string; text: string; publishedAt: string; likeCount: number }>; nextPageToken?: string }> {
    let url = `${this.apiUrl}/commentThreads?part=snippet&videoId=${videoId}&maxResults=50&order=time`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube comments error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      comments: (data.items || []).map((item: any) => ({
        id: item.id,
        authorName: item.snippet.topLevelComment.snippet.authorDisplayName,
        authorChannelId: item.snippet.topLevelComment.snippet.authorChannelId?.value || '',
        text: item.snippet.topLevelComment.snippet.textOriginal,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
        likeCount: item.snippet.topLevelComment.snippet.likeCount || 0,
      })),
      nextPageToken: data.nextPageToken,
    };
  }

  async replyToComment(tokens: YouTubeTokens, parentId: string, text: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/comments?part=snippet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          parentId,
          textOriginal: text,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube reply error ${response.status}: ${error}`);
    }
  }

  async getTrending(regionCode: string = 'US', categoryId: string = '22'): Promise<Array<{ title: string; tags: string[] }>> {
    const response = await fetch(
      `${this.apiUrl}/videos?part=snippet&chart=mostPopular&regionCode=${regionCode}&videoCategoryId=${categoryId}&maxResults=25`,
      { headers: { 'Authorization': `Bearer ${process.env.YOUTUBE_API_KEY || ''}` } },
    );

    if (!response.ok) return [];

    const data = await response.json() as any;
    return (data.items || []).map((item: any) => ({
      title: item.snippet.title,
      tags: item.snippet.tags || [],
    }));
  }

  async refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube token refresh error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
}

export const youtubeClient = new YouTubeClient();
