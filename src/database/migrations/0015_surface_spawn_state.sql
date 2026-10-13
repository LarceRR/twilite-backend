ALTER TABLE "surfaces"
  ADD COLUMN "spawn_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "recent_spawn_columns" integer[] DEFAULT '{}'::integer[] NOT NULL;

UPDATE "surfaces" AS surface
SET
  "spawn_count" = (
    SELECT count(*)::integer
    FROM "surface_objects" AS object
    WHERE object."surface_id" = surface."id"
  ),
  "recent_spawn_columns" = COALESCE(
    ARRAY(
      SELECT object."cell_x"
      FROM "surface_objects" AS object
      WHERE object."surface_id" = surface."id" AND object."cell_x" >= 0
      ORDER BY object."created_at" DESC, object."id" DESC
      LIMIT 3
    ),
    '{}'::integer[]
  );

ALTER TABLE "surfaces"
  ADD CONSTRAINT "surfaces_spawn_state_check"
  CHECK (
    "spawn_count" >= 0
    AND cardinality("recent_spawn_columns") <= 3
    AND 0 <= ALL("recent_spawn_columns")
  );