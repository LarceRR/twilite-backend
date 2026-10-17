ALTER TABLE "surfaces"
  ADD COLUMN "active_object_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "last_spawn_x" integer,
  ADD COLUMN "last_spawn_y" integer;

UPDATE "surfaces" AS surface
SET
  "active_object_count" = (
    SELECT count(*)::integer
    FROM "surface_objects" AS object
    WHERE object."surface_id" = surface."id"
  ),
  "last_spawn_x" = (
    SELECT object."cell_x"
    FROM "surface_objects" AS object
    WHERE object."surface_id" = surface."id"
    ORDER BY object."created_at" DESC, object."id" DESC
    LIMIT 1
  ),
  "last_spawn_y" = (
    SELECT object."cell_y"
    FROM "surface_objects" AS object
    WHERE object."surface_id" = surface."id"
    ORDER BY object."created_at" DESC, object."id" DESC
    LIMIT 1
  );

ALTER TABLE "surfaces"
  DROP CONSTRAINT "surfaces_spawn_state_check",
  ADD CONSTRAINT "surfaces_spawn_state_check"
    CHECK (
      "spawn_count" >= 0
      AND "active_object_count" >= 0
      AND cardinality("recent_spawn_columns") <= 3
      AND 0 <= ALL("recent_spawn_columns")
    );