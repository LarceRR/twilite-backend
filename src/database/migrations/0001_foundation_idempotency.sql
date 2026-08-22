CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response" jsonb NOT NULL,
  "status_code" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_scope_key_unique" ON "idempotency_records" USING btree ("scope", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_expires_idx" ON "idempotency_records" USING btree ("expires_at");
