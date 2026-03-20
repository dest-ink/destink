CREATE TABLE "draft_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"note_length_min" integer DEFAULT 150,
	"note_length_max" integer DEFAULT 300,
	"article_length_min" integer DEFAULT 800,
	"article_length_max" integer DEFAULT 2000,
	"vocabulary_level" text DEFAULT 'accessible',
	"jargon_handling" text DEFAULT 'explain',
	"preferred_phrases" jsonb DEFAULT '[]'::jsonb,
	"avoided_phrases" jsonb DEFAULT '[]'::jsonb,
	"use_em_dashes" boolean DEFAULT true,
	"use_oxford_comma" boolean DEFAULT true,
	"use_semicolons" boolean DEFAULT false,
	"use_exclamation_marks" boolean DEFAULT false,
	"use_ellipsis" boolean DEFAULT false,
	"use_parentheticals" boolean DEFAULT true,
	"headline_case" text DEFAULT 'sentence',
	"emphasis_style" text DEFAULT 'bold',
	"use_all_caps" boolean DEFAULT false,
	"paragraph_length" text DEFAULT 'short',
	"use_subheadings" boolean DEFAULT true,
	"use_bullet_lists" boolean DEFAULT true,
	"use_numbered_lists" boolean DEFAULT false,
	"use_blockquotes" boolean DEFAULT false,
	"humor_level" text DEFAULT 'none',
	"formality_level" text DEFAULT 'conversational',
	"opinion_strength" text DEFAULT 'balanced',
	"cta_style" text DEFAULT 'question',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_preferences_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "researchers" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "draft_preferences" ADD CONSTRAINT "draft_preferences_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;