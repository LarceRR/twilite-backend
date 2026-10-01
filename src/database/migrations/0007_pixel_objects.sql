CREATE TYPE "public"."pixel_object_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "pixel_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"sheet_media_id" uuid NOT NULL,
	"status" "pixel_object_status" DEFAULT 'pending' NOT NULL,
	"rejection_comment" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_sheet_media_id_media_assets_id_fk" FOREIGN KEY ("sheet_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixel_objects_status_created_idx" ON "pixel_objects" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pixel_objects_author_idx" ON "pixel_objects" USING btree ("author_user_id","updated_at");
