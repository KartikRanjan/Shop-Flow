ALTER TYPE "public"."user_roles" ADD VALUE 'super_admin' BEFORE 'seller';--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_number_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_email_idx" ON "users" USING btree ("email") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_phone_idx" ON "users" USING btree ("phone_number") WHERE "deleted_at" IS NULL AND "phone_number" IS NOT NULL;