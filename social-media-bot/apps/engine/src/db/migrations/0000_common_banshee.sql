CREATE TYPE "public"."content_status" AS ENUM('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('text', 'image', 'video', 'carousel', 'reel', 'short');--> statement-breakpoint
CREATE TYPE "public"."platform_type" AS ENUM('tiktok', 'instagram', 'twitter', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('pending', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reply_status" AS ENUM('pending', 'sent', 'failed', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."trend_source" AS ENUM('google_trends', 'tiktok_creative', 'twitter_trending', 'youtube_trending');--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"followers" integer,
	"following" integer,
	"total_posts" integer,
	"period_likes" integer,
	"period_comments" integer,
	"period_shares" integer,
	"period_views" integer,
	"engagement_rate" real,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "content_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"content_type" "content_type" NOT NULL,
	"caption" text NOT NULL,
	"hashtags" text[],
	"media_urls" text[],
	"inspired_by" uuid,
	"target_platforms" text[],
	"generated_at" timestamp DEFAULT now(),
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "engagement_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform_type" NOT NULL,
	"post_id" uuid,
	"platform_comment_id" text NOT NULL,
	"comment_text" text NOT NULL,
	"reply_text" text NOT NULL,
	"reply_status" "reply_status" DEFAULT 'pending' NOT NULL,
	"replied_at" timestamp,
	"flagged_reason" text
);
--> statement-breakpoint
CREATE TABLE "platform_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform_type" NOT NULL,
	"account_name" text NOT NULL,
	"credentials" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"connected_at" timestamp DEFAULT now(),
	"last_token_refresh" timestamp
);
--> statement-breakpoint
CREATE TABLE "post_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_post_id" uuid NOT NULL,
	"collected_at" timestamp DEFAULT now(),
	"views" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"saves" integer,
	"reach" integer,
	"engagement_rate" real
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"platform" "platform_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"published_at" timestamp,
	"platform_post_id" text,
	"status" "post_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "trend_source" NOT NULL,
	"topic" text NOT NULL,
	"hashtags" text[],
	"relevance_score" real,
	"raw_data" jsonb,
	"discovered_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_queue" ADD CONSTRAINT "content_queue_inspired_by_trending_topics_id_fk" FOREIGN KEY ("inspired_by") REFERENCES "public"."trending_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_replies" ADD CONSTRAINT "engagement_replies_post_id_scheduled_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."scheduled_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_analytics" ADD CONSTRAINT "post_analytics_scheduled_post_id_scheduled_posts_id_fk" FOREIGN KEY ("scheduled_post_id") REFERENCES "public"."scheduled_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_content_id_content_queue_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_account_date" ON "analytics_snapshots" USING btree ("account_id","snapshot_date");