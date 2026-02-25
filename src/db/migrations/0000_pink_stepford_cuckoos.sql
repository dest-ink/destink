CREATE TYPE "public"."content_type" AS ENUM('note', 'article');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending_review', 'approved', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('linkedin', 'substack');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('queued', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."voice_method" AS ENUM('archive', 'samples', 'wizard');--> statement-breakpoint
CREATE TABLE "ai_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6),
	"channel_id" uuid,
	"entity_type" text,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_id" text,
	"persona_prompt" text,
	"research_config" jsonb,
	"schedule_config" jsonb,
	"credentials" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"research_run_id" uuid,
	"content_type" "content_type" NOT NULL,
	"title" text,
	"headline_options" jsonb,
	"hook" text,
	"body" text,
	"cta" text,
	"voice_confidence" integer,
	"research_sources" jsonb,
	"ai_model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"status" "draft_status" DEFAULT 'pending_review' NOT NULL,
	"rejection_reason" text,
	"regeneration_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"platform_response" jsonb,
	"status" "queue_status" DEFAULT 'queued' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sources_searched" jsonb,
	"topics_found" jsonb,
	"drafts_generated" jsonb,
	"ai_model" text,
	"tokens_used" integer,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"method" "voice_method" NOT NULL,
	"raw_input" text,
	"extracted_profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;