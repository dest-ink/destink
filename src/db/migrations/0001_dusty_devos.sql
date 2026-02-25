ALTER TABLE "research_runs" DROP CONSTRAINT "research_runs_channel_id_channels_id_fk";
--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;