CREATE TABLE "subscription_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"name" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"duration" text DEFAULT 'once' NOT NULL,
	"duration_in_months" integer,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "feature_overrides" jsonb;--> statement-breakpoint
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_coupons_code_idx" ON "subscription_coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "subscription_coupons_active_idx" ON "subscription_coupons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "content_translations_org_idx" ON "content_translations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_translations_entity_idx" ON "content_translations" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "content_translations_locale_idx" ON "content_translations" USING btree ("organization_id","entity_type","entity_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_translations_unique_idx" ON "content_translations" USING btree ("organization_id","entity_type","entity_id","locale","field");