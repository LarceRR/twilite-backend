CREATE INDEX "pixel_objects_catalog_type_idx" ON "pixel_objects" ("object_type", "project_id") WHERE "published_revision_id" IS NOT NULL AND "status" <> 'archived';
