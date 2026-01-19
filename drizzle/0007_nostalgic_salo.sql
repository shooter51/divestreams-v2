CREATE TABLE "gallery_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"cover_image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"album_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"date_taken" date,
	"location" text,
	"photographer" text,
	"trip_id" uuid,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_album_id_gallery_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_albums_org_idx" ON "gallery_albums" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_albums_org_slug_idx" ON "gallery_albums" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "gallery_albums_public_idx" ON "gallery_albums" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "gallery_images_org_idx" ON "gallery_images" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gallery_images_album_idx" ON "gallery_images" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "gallery_images_category_idx" ON "gallery_images" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "gallery_images_featured_idx" ON "gallery_images" USING btree ("organization_id","is_featured");--> statement-breakpoint
CREATE INDEX "gallery_images_status_idx" ON "gallery_images" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "gallery_images_trip_idx" ON "gallery_images" USING btree ("trip_id");