ALTER TABLE "tpg_projects" ADD COLUMN "is_reassignment_inbox" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "tpg_projects_reassignment_inbox_uidx" ON "tpg_projects" ("owner_id") WHERE "is_reassignment_inbox" = true;
--> statement-breakpoint
DO $$
DECLARE
  twilite_id uuid;
  inbox_id uuid;
BEGIN
  SELECT "id" INTO twilite_id FROM "users" WHERE "email" = 'twilite@app.ru' LIMIT 1;
  IF twilite_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "id" INTO inbox_id
  FROM "tpg_projects"
  WHERE "owner_id" = twilite_id AND "is_reassignment_inbox" = true
  LIMIT 1;

  IF inbox_id IS NULL AND EXISTS (
    SELECT 1 FROM "pixel_objects" WHERE "status" = 'archived'
  ) THEN
    INSERT INTO "tpg_projects" ("owner_id", "title", "description", "is_reassignment_inbox")
    VALUES (twilite_id, 'Переназначенные', '', true)
    RETURNING "id" INTO inbox_id;
  END IF;

  IF inbox_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "pixel_objects"
  SET "author_user_id" = twilite_id,
      "project_id" = inbox_id,
      "status" = 'published',
      "updated_at" = now()
  WHERE "status" = 'archived';
END $$;
