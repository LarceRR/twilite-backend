-- P2-S1: immutable pixel_object_revisions + head pointers (ADR-003).
-- Rollback: drop FKs on pixel_objects revision pointers, DROP TABLE pixel_object_revisions,
-- DROP columns published_revision_id / pending_revision_id. Head columns remain authoritative until P2-S2.

CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TABLE "pixel_object_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pixel_object_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"manifest" jsonb NOT NULL,
	"sheet_media_id" uuid NOT NULL,
	"preview_media_id" uuid,
	"content_hash" text NOT NULL,
	"status" "pixel_object_status" DEFAULT 'pending' NOT NULL,
	"rejection_comment" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pixel_object_revisions" ADD CONSTRAINT "pixel_object_revisions_pixel_object_id_pixel_objects_id_fk" FOREIGN KEY ("pixel_object_id") REFERENCES "public"."pixel_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_object_revisions" ADD CONSTRAINT "pixel_object_revisions_sheet_media_id_media_assets_id_fk" FOREIGN KEY ("sheet_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_object_revisions" ADD CONSTRAINT "pixel_object_revisions_preview_media_id_media_assets_id_fk" FOREIGN KEY ("preview_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_object_revisions" ADD CONSTRAINT "pixel_object_revisions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pixel_object_revisions_object_revision_uidx" ON "pixel_object_revisions" USING btree ("pixel_object_id","revision_number");--> statement-breakpoint
CREATE INDEX "pixel_object_revisions_object_status_idx" ON "pixel_object_revisions" USING btree ("pixel_object_id","status");--> statement-breakpoint
CREATE INDEX "pixel_object_revisions_sheet_media_idx" ON "pixel_object_revisions" USING btree ("sheet_media_id");--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD COLUMN "published_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD COLUMN "pending_revision_id" uuid;--> statement-breakpoint
-- Backfill: one revision per existing head; revision_number = current integer column.
INSERT INTO "pixel_object_revisions" (
	"id",
	"pixel_object_id",
	"revision_number",
	"manifest",
	"sheet_media_id",
	"preview_media_id",
	"content_hash",
	"status",
	"rejection_comment",
	"reviewed_by_user_id",
	"reviewed_at",
	"created_at",
	"published_at"
)
SELECT
	gen_random_uuid(),
	po."id",
	po."revision",
	po."manifest",
	po."sheet_media_id",
	NULL,
	encode(
		sha256(
			convert_to(po."manifest"::text, 'UTF8')
			|| '\x00'::bytea
			|| convert_to(po."sheet_media_id"::text, 'UTF8')
		),
		'hex'
	),
	po."status",
	po."rejection_comment",
	po."reviewed_by_user_id",
	po."reviewed_at",
	po."created_at",
	CASE
		WHEN po."status" = 'published' THEN COALESCE(po."reviewed_at", po."updated_at")
		ELSE NULL
	END
FROM "pixel_objects" po;--> statement-breakpoint
UPDATE "pixel_objects" AS po
SET "published_revision_id" = r."id"
FROM "pixel_object_revisions" AS r
WHERE r."pixel_object_id" = po."id"
	AND po."status" = 'published';--> statement-breakpoint
UPDATE "pixel_objects" AS po
SET "pending_revision_id" = r."id"
FROM "pixel_object_revisions" AS r
WHERE r."pixel_object_id" = po."id"
	AND po."status" IN ('pending', 'rejected');--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_published_revision_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."pixel_object_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_pending_revision_id_pixel_object_revisions_id_fk" FOREIGN KEY ("pending_revision_id") REFERENCES "public"."pixel_object_revisions"("id") ON DELETE set null ON UPDATE no action;
