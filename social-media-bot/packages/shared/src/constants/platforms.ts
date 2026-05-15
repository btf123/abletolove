import type { ContentType, PlatformType } from '../types/platform.js';

export interface PlatformLimits {
  maxCaptionLength: number;
  maxHashtags: number;
  supportedContentTypes: ContentType[];
  maxPostsPerDay: number;
}

export const PLATFORM_LIMITS: Record<PlatformType, PlatformLimits> = {
  tiktok: {
    maxCaptionLength: 2200,
    maxHashtags: 8,
    supportedContentTypes: ['video', 'short'],
    maxPostsPerDay: 3,
  },
  instagram: {
    maxCaptionLength: 2200,
    maxHashtags: 30,
    supportedContentTypes: ['image', 'video', 'carousel', 'reel'],
    maxPostsPerDay: 5,
  },
  twitter: {
    maxCaptionLength: 280,
    maxHashtags: 3,
    supportedContentTypes: ['text', 'image', 'video'],
    maxPostsPerDay: 10,
  },
  youtube: {
    maxCaptionLength: 5000,
    maxHashtags: 15,
    supportedContentTypes: ['video', 'short'],
    maxPostsPerDay: 2,
  },
};
