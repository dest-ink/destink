-- Add user_id to channels
ALTER TABLE "channels" ADD COLUMN "user_id" uuid;
UPDATE "channels" SET "user_id" = '767fb280-f1cf-4321-9e91-53548d9a93f3' WHERE "user_id" IS NULL;
ALTER TABLE "channels" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Add user_id to researchers
ALTER TABLE "researchers" ADD COLUMN "user_id" uuid;
UPDATE "researchers" SET "user_id" = '767fb280-f1cf-4321-9e91-53548d9a93f3' WHERE "user_id" IS NULL;
ALTER TABLE "researchers" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "researchers" ADD CONSTRAINT "researchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
