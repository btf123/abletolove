import type { FormattedPost, PlatformType, ContentType } from '@smbot/shared';
import { PLATFORM_LIMITS } from '@smbot/shared';

interface RawContent {
  caption: string;
  hashtags: string[];
  callToAction?: string;
  hook?: string;
  talkingPoints?: string[];
  slides?: Array<{ headline: string; body: string }>;
}

export function formatForPlatform(
  raw: RawContent,
  platform: PlatformType,
  contentType: ContentType,
  mediaUrls: string[] = [],
): FormattedPost {
  const limits = PLATFORM_LIMITS[platform];

  let caption = raw.caption;

  if (platform === 'twitter') {
    caption = buildTwitterCaption(raw, limits.maxCaptionLength);
  } else {
    if (raw.callToAction && !caption.includes(raw.callToAction)) {
      caption = `${caption}\n\n${raw.callToAction}`;
    }
  }

  const hashtags = raw.hashtags
    .slice(0, limits.maxHashtags)
    .map((h) => h.startsWith('#') ? h.slice(1) : h);

  caption = caption.slice(0, limits.maxCaptionLength);

  return { caption, hashtags, mediaUrls, contentType };
}

function buildTwitterCaption(raw: RawContent, maxLength: number): string {
  let caption = raw.caption;
  const tags = raw.hashtags.slice(0, 3).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ');

  if (caption.length + tags.length + 2 <= maxLength) {
    caption = `${caption}\n\n${tags}`;
  } else {
    caption = caption.slice(0, maxLength);
  }

  return caption;
}

export function getContentTypeForPlatform(platform: PlatformType): ContentType {
  switch (platform) {
    case 'tiktok': return 'video';
    case 'instagram': return 'reel';
    case 'twitter': return 'text';
    case 'youtube': return 'short';
  }
}
