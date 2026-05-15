interface InstagramTokens {
  accessToken: string;
  userId: string;
  expiresAt: number;
}

export class InstagramClient {
  private graphUrl = 'https://graph.facebook.com/v21.0';

  async createMediaContainer(tokens: InstagramTokens, imageUrl: string, caption: string): Promise<string> {
    const params = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: tokens.accessToken,
    });

    const response = await fetch(`${this.graphUrl}/${tokens.userId}/media`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram create media error ${response.status}: ${error}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  async createReelContainer(tokens: InstagramTokens, videoUrl: string, caption: string): Promise<string> {
    const params = new URLSearchParams({
      video_url: videoUrl,
      caption,
      media_type: 'REELS',
      access_token: tokens.accessToken,
    });

    const response = await fetch(`${this.graphUrl}/${tokens.userId}/media`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram create reel error ${response.status}: ${error}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  async createCarouselContainer(tokens: InstagramTokens, childIds: string[], caption: string): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      caption,
      access_token: tokens.accessToken,
    });
    childIds.forEach((id) => params.append('children', id));

    const response = await fetch(`${this.graphUrl}/${tokens.userId}/media`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram carousel error ${response.status}: ${error}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  async publishMedia(tokens: InstagramTokens, containerId: string): Promise<string> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: tokens.accessToken,
    });

    const response = await fetch(`${this.graphUrl}/${tokens.userId}/media_publish`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram publish error ${response.status}: ${error}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  async getMediaInsights(tokens: InstagramTokens, mediaId: string): Promise<{ impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number }> {
    const response = await fetch(
      `${this.graphUrl}/${mediaId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${tokens.accessToken}`,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram insights error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    const metrics: Record<string, number> = {};
    for (const item of data.data) {
      metrics[item.name] = item.values?.[0]?.value || 0;
    }
    return {
      impressions: metrics.impressions || 0,
      reach: metrics.reach || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      saves: metrics.saved || 0,
    };
  }

  async getAccountInfo(tokens: InstagramTokens): Promise<{ followersCount: number; followsCount: number; mediaCount: number }> {
    const response = await fetch(
      `${this.graphUrl}/${tokens.userId}?fields=followers_count,follows_count,media_count&access_token=${tokens.accessToken}`,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram account info error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      followersCount: data.followers_count,
      followsCount: data.follows_count,
      mediaCount: data.media_count,
    };
  }

  async getMediaComments(tokens: InstagramTokens, mediaId: string): Promise<Array<{ id: string; text: string; username: string; timestamp: string; likeCount: number }>> {
    const response = await fetch(
      `${this.graphUrl}/${mediaId}/comments?fields=id,text,username,timestamp,like_count&access_token=${tokens.accessToken}`,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram comments error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return (data.data || []).map((c: any) => ({
      id: c.id,
      text: c.text,
      username: c.username,
      timestamp: c.timestamp,
      likeCount: c.like_count || 0,
    }));
  }

  async replyToComment(tokens: InstagramTokens, commentId: string, message: string): Promise<void> {
    const params = new URLSearchParams({
      message,
      access_token: tokens.accessToken,
    });

    const response = await fetch(`${this.graphUrl}/${commentId}/replies`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram reply error ${response.status}: ${error}`);
    }
  }

  async refreshLongLivedToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch(
      `${this.graphUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&fb_exchange_token=${accessToken}`,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram token refresh error ${response.status}: ${error}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
}

export const instagramClient = new InstagramClient();
