import type { ContentType, ContentStatus, PlatformType } from './platform.js';

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
  callToAction: string;
  contentType: ContentType;
  targetPlatforms: PlatformType[];
  inspiredByTrend?: string;
}

export interface ScheduledPost {
  contentId: string;
  platform: PlatformType;
  accountId: string;
  scheduledFor: Date;
}

export interface ContentDraft {
  id: string;
  status: ContentStatus;
  caption: string;
  hashtags: string[];
  contentType: ContentType;
  targetPlatforms: PlatformType[];
  generatedAt: Date;
  approvedAt?: Date;
}

export interface PostingWindow {
  platform: PlatformType;
  hours: number[];
  timezone: string;
}

export const DEFAULT_POSTING_WINDOWS: PostingWindow[] = [
  { platform: 'tiktok', hours: [7, 12, 19], timezone: 'UTC' },
  { platform: 'instagram', hours: [11, 13, 19], timezone: 'UTC' },
  { platform: 'twitter', hours: [8, 12, 17], timezone: 'UTC' },
  { platform: 'youtube', hours: [14, 17], timezone: 'UTC' },
];
