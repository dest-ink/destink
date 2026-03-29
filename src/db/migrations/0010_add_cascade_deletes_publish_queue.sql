ALTER TABLE "publish_queue" DROP CONSTRAINT "publish_queue_draft_id_drafts_id_fk";
ALTER TABLE "publish_queue" DROP CONSTRAINT "publish_queue_channel_id_channels_id_fk";
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE CASCADE;
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE;
