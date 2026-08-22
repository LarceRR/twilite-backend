ALTER TABLE "idempotency_records" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "idempotency_records" ALTER COLUMN "response" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "idempotency_records" ALTER COLUMN "status_code" DROP NOT NULL;
