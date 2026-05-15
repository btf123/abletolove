import { pgTable, uuid, text, timestamp, boolean, integer, real, jsonb, pgEnum, uniqueIndex, date } from 'drizzle-orm/pg-core';

export const platformEnum = pgEnum('platform_type', ['tiktok', 'instagram', 'twitter', 'youtube']);
export const contentStatusEnum = pgEnum('content_status', ['draft', 'approved', 'scheduled', 'publishing', 'published', 'failed']);
export const contentTypeEnum = pgEnum('content_type', ['text', 'image', 'video', 'carousel', 'reel', 'short']);
export const replyStatusEnum = pgEnum('reply_status', ['pending', 'sent', 'failed', 'flagged']);
export const trendSourceEnum = pgEnum('trend_source', ['google_trends', 'tiktok_creative', 'twitter_trending', 'youtube_trending']);
export const postStatusEnum = pgEnum('post_status', ['pending', 'publishing', 'published', 'failed']);

export const platformAccounts = pgTable('platform_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: platformEnum('platform').notNull(),
  accountName: text('account_name').notNull(),
  credentials: jsonb('credentials').notNull(),
  isActive: boolean('is_active').default(true),
  connectedAt: timestamp('connected_at').defaultNow(),
  lastTokenRefresh: timestamp('last_token_refresh'),
});

export const trendingTopics = pgTable('trending_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: trendSourceEnum('source').notNull(),
  topic: text('topic').notNull(),
  hashtags: text('hashtags').array(),
  relevanceScore: real('relevance_score'),
  rawData: jsonb('raw_data'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const contentQueue = pgTable('content_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: contentStatusEnum('status').notNull().default('draft'),
  contentType: contentTypeEnum('content_type').notNull(),
  caption: text('caption').notNull(),
  hashtags: text('hashtags').array(),
  mediaUrls: text('media_urls').array(),
  inspiredBy: uuid('inspired_by').references(() => trendingTopics.id),
  targetPlatforms: text('target_platforms').array(),
  generatedAt: timestamp('generated_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
});

export const scheduledPosts = pgTable('scheduled_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').references(() => contentQueue.id).notNull(),
  platform: platformEnum('platform').notNull(),
  accountId: uuid('account_id').references(() => platformAccounts.id).notNull(),
  scheduledFor: timestamp('scheduled_for').notNull(),
  publishedAt: timestamp('published_at'),
  platformPostId: text('platform_post_id'),
  status: postStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
});

export const engagementReplies = pgTable('engagement_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: platformEnum('platform').notNull(),
  postId: uuid('post_id').references(() => scheduledPosts.id),
  platformCommentId: text('platform_comment_id').notNull(),
  commentText: text('comment_text').notNull(),
  replyText: text('reply_text').notNull(),
  replyStatus: replyStatusEnum('reply_status').notNull().default('pending'),
  repliedAt: timestamp('replied_at'),
  flaggedReason: text('flagged_reason'),
});

export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: platformEnum('platform').notNull(),
  accountId: uuid('account_id').references(() => platformAccounts.id).notNull(),
  snapshotDate: date('snapshot_date').notNull(),
  followers: integer('followers'),
  following: integer('following'),
  totalPosts: integer('total_posts'),
  periodLikes: integer('period_likes'),
  periodComments: integer('period_comments'),
  periodShares: integer('period_shares'),
  periodViews: integer('period_views'),
  engagementRate: real('engagement_rate'),
  rawData: jsonb('raw_data'),
}, (table) => [
  uniqueIndex('unique_account_date').on(table.accountId, table.snapshotDate),
]);

export const postAnalytics = pgTable('post_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduledPostId: uuid('scheduled_post_id').references(() => scheduledPosts.id).notNull(),
  collectedAt: timestamp('collected_at').defaultNow(),
  views: integer('views'),
  likes: integer('likes'),
  comments: integer('comments'),
  shares: integer('shares'),
  saves: integer('saves'),
  reach: integer('reach'),
  engagementRate: real('engagement_rate'),
});

export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
