export type PlatformType = 'tiktok' | 'instagram' | 'twitter' | 'youtube';

export type ContentType = 'text' | 'image' | 'video' | 'carousel' | 'reel' | 'short';

export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';

export type ReplyStatus = 'pending' | 'sent' | 'failed' | 'flagged';

export type TrendSource = 'google_trends' | 'tiktok_creative' | 'twitter_trending' | 'youtube_trending';

export interface PlatformPostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export interface PlatformComment {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  createdAt: Date;
  likeCount: number;
}

export interface AccountMetrics {
  followers: number;
  following: number;
  totalPosts: number;
}

export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  engagementRate: number;
}

export interface FormattedPost {
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
  contentType: ContentType;
}

export interface TrendingItem {
  topic: string;
  hashtags: string[];
  volume: number;
  velocity: number;
  source: TrendSource;
}
