CREATE TYPE "public"."app_theme_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "app_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"colors" jsonb NOT NULL,
	"scene_background_colors" jsonb NOT NULL,
	"status" "app_theme_status" DEFAULT 'pending' NOT NULL,
	"rejection_comment" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_themes" ADD CONSTRAINT "app_themes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_themes" ADD CONSTRAINT "app_themes_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_themes_status_created_idx" ON "app_themes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "app_themes_author_idx" ON "app_themes" USING btree ("author_user_id","created_at");
