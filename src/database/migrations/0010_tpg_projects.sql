-- Wipe test pixel objects before requiring project_id.
UPDATE "surface_objects" SET "pixel_object_id" = NULL WHERE "pixel_object_id" IS NOT NULL;--> statement-breakpoint
UPDATE "pixel_objects" SET "published_revision_id" = NULL, "pending_revision_id" = NULL;--> statement-breakpoint
DELETE FROM "pixel_object_revisions";--> statement-breakpoint
DELETE FROM "pixel_objects";--> statement-breakpoint
CREATE TABLE "tpg_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"avatar_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tpg_projects" ADD CONSTRAINT "tpg_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tpg_projects" ADD CONSTRAINT "tpg_projects_avatar_media_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tpg_projects_owner_updated_idx" ON "tpg_projects" USING btree ("owner_id","updated_at");--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_project_id_tpg_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tpg_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixel_objects_project_created_idx" ON "pixel_objects" USING btree ("project_id","created_at");
