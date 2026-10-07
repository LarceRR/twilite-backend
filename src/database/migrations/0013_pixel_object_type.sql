ALTER TABLE "pixel_objects" ADD COLUMN "object_type" text DEFAULT 'Good' NOT NULL;
ALTER TABLE "pixel_objects" ADD CONSTRAINT "pixel_objects_object_type_check" CHECK ("object_type" IN ('Good', 'Bad'));
