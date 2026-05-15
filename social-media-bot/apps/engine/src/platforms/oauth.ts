import { env } from '../config/env.js';

export function getOAuthUrl(platform: string): string | null {
  switch (platform) {
    case 'twitter': {
      if (!env.TWITTER_API_KEY) return null;
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.TWITTER_API_KEY,
        redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/twitter`,
        scope: 'tweet.read tweet.write users.read offline.access',
        state: 'twitter',
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
      });
      return `https://twitter.com/i/oauth2/authorize?${params}`;
    }

    case 'tiktok': {
      if (!env.TIKTOK_CLIENT_KEY) return null;
      const params = new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        response_type: 'code',
        scope: 'user.info.basic,video.publish,video.list',
        redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/tiktok`,
        state: 'tiktok',
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
    }

    case 'instagram': {
      if (!env.INSTAGRAM_APP_ID) return null;
      const params = new URLSearchParams({
        client_id: env.INSTAGRAM_APP_ID,
        redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/instagram`,
        scope: 'instagram_basic,instagram_content_publish,instagram_manage_comments,pages_show_list',
        response_type: 'code',
        state: 'instagram',
      });
      return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
    }

    case 'youtube': {
      if (!env.YOUTUBE_CLIENT_ID) return null;
      const params = new URLSearchParams({
        client_id: env.YOUTUBE_CLIENT_ID,
        redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/youtube`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl',
        access_type: 'offline',
        prompt: 'consent',
        state: 'youtube',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    default:
      return null;
  }
}

export async function exchangeTwitterCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${env.TWITTER_API_KEY}:${env.TWITTER_API_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/twitter`,
      code_verifier: 'challenge',
    }),
  });
  if (!response.ok) throw new Error(`Twitter token exchange failed: ${await response.text()}`);
  const data = await response.json() as any;
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function exchangeTikTokCode(code: string): Promise<{ accessToken: string; refreshToken: string; openId: string }> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      client_secret: env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/tiktok`,
    }),
  });
  if (!response.ok) throw new Error(`TikTok token exchange failed: ${await response.text()}`);
  const data = await response.json() as any;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, openId: data.open_id };
}

export async function exchangeInstagramCode(code: string): Promise<{ accessToken: string; userId: string }> {
  // Step 1: Exchange code for short-lived token
  const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      client_secret: env.INSTAGRAM_APP_SECRET!,
      code,
      redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/instagram`,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Instagram token exchange failed: ${await tokenResponse.text()}`);
  const tokenData = await tokenResponse.json() as any;

  // Step 2: Exchange for long-lived token
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.INSTAGRAM_APP_ID}&client_secret=${env.INSTAGRAM_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`,
  );
  const longLivedData = await longLivedResponse.json() as any;

  // Step 3: Get Instagram business account ID
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedData.access_token}`,
  );
  const pagesData = await pagesResponse.json() as any;
  const page = pagesData.data?.[0];
  if (!page) throw new Error('No Facebook Page found. Instagram Business account requires a linked Page.');

  const igResponse = await fetch(
    `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${longLivedData.access_token}`,
  );
  const igData = await igResponse.json() as any;
  const igUserId = igData.instagram_business_account?.id;
  if (!igUserId) throw new Error('No Instagram Business account linked to this Facebook Page.');

  return { accessToken: longLivedData.access_token, userId: igUserId };
}

export async function exchangeYouTubeCode(code: string): Promise<{ accessToken: string; refreshToken: string; channelId: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.YOUTUBE_CLIENT_ID!,
      client_secret: env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: `http://localhost:${env.ENGINE_PORT}/api/oauth/callback/youtube`,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`YouTube token exchange failed: ${await response.text()}`);
  const data = await response.json() as any;

  // Get channel ID
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&mine=true`,
    { headers: { 'Authorization': `Bearer ${data.access_token}` } },
  );
  const channelData = await channelResponse.json() as any;
  const channelId = channelData.items?.[0]?.id || '';

  return { accessToken: data.access_token, refreshToken: data.refresh_token, channelId };
}
