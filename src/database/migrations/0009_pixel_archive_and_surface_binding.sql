-- P2-S5 archive status + P2-S6 surface_objects.pixel_object_id FK (ADR-004, ADR-007).
-- Rollback: drop FK/column pixel_object_id; cannot easily remove enum value — leave archived unused.

ALTER TYPE "public"."pixel_object_status" ADD VALUE IF NOT EXISTS 'archived';
--> statement-breakpoint
ALTER TABLE "surface_objects" ADD COLUMN "pixel_object_id" uuid;
--> statement-breakpoint
-- Backfill only metadata.pixelObjectId values that point at published heads.
UPDATE "surface_objects" AS so
SET "pixel_object_id" = (so."metadata"->>'pixelObjectId')::uuid
WHERE so."metadata" ? 'pixelObjectId'
  AND (so."metadata"->>'pixelObjectId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM "pixel_objects" po
    WHERE po."id" = (so."metadata"->>'pixelObjectId')::uuid
      AND po."published_revision_id" IS NOT NULL
  );
--> statement-breakpoint
ALTER TABLE "surface_objects" ADD CONSTRAINT "surface_objects_pixel_object_id_pixel_objects_id_fk" FOREIGN KEY ("pixel_object_id") REFERENCES "public"."pixel_objects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "surface_objects_pixel_object_idx" ON "surface_objects" USING btree ("pixel_object_id");
