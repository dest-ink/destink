ALTER TABLE "researchers" ADD COLUMN "max_drafts_per_run" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "researchers" ADD COLUMN "short_form_percent" integer DEFAULT 70 NOT NULL;--> statement-breakpoint

-- Back-fill from existing sourceConfig JSON
UPDATE "researchers"
SET
  "max_drafts_per_run" = COALESCE(
    (source_config->>'maxDraftsPerRun')::integer,
    3
  ),
  "short_form_percent" = COALESCE(
    (source_config->'contentTypeMix'->>'note')::integer,
    70
  );

-- Strip migrated fields from the JSON blob
UPDATE "researchers"
SET source_config = source_config
  - 'maxDraftsPerRun'
  - 'scheduleHours'
  - 'contentTypeMix';