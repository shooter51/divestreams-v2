CREATE TABLE "boats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"capacity" integer NOT NULL,
	"type" text,
	"registration_number" text,
	"images" jsonb,
	"amenities" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"booking_number" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"participants" integer DEFAULT 1 NOT NULL,
	"participant_details" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0',
	"tax" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"deposit_amount" numeric(10, 2),
	"deposit_paid_at" timestamp,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"stripe_payment_intent_id" text,
	"equipment_rental" jsonb,
	"waiver_signed_at" timestamp,
	"medical_form_signed_at" timestamp,
	"special_requests" text,
	"internal_notes" text,
	"source" text DEFAULT 'direct',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"date_of_birth" date,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"medical_conditions" text,
	"medications" text,
	"certifications" jsonb,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"preferred_language" text DEFAULT 'en',
	"marketing_opt_in" boolean DEFAULT false,
	"notes" text,
	"tags" jsonb,
	"total_dives" integer DEFAULT 0,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"last_dive_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_booking_amount" numeric(10, 2),
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"applicable_to" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dive_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"max_depth" integer,
	"min_depth" integer,
	"difficulty" text,
	"current_strength" text,
	"visibility" text,
	"highlights" jsonb,
	"images" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"model" text,
	"serial_number" text,
	"size" text,
	"status" text DEFAULT 'available' NOT NULL,
	"condition" text DEFAULT 'good',
	"rental_price" numeric(10, 2),
	"is_rentable" boolean DEFAULT true,
	"last_service_date" date,
	"next_service_date" date,
	"service_notes" text,
	"purchase_date" date,
	"purchase_price" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"sale_price" numeric(10, 2),
	"sale_start_date" timestamp,
	"sale_end_date" timestamp,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"transaction_id" uuid,
	"customer_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"rented_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp NOT NULL,
	"returned_at" timestamp,
	"daily_rate" numeric(10, 2) NOT NULL,
	"total_charge" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"agreement_number" text NOT NULL,
	"agreement_signed_at" timestamp,
	"agreement_signed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour_dive_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"tour_id" uuid NOT NULL,
	"dive_site_id" uuid NOT NULL,
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"duration" integer,
	"max_participants" integer NOT NULL,
	"min_participants" integer DEFAULT 1,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"includes_equipment" boolean DEFAULT false,
	"includes_meals" boolean DEFAULT false,
	"includes_transport" boolean DEFAULT false,
	"inclusions" jsonb,
	"exclusions" jsonb,
	"min_cert_level" text,
	"min_age" integer,
	"requirements" jsonb,
	"images" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"booking_id" uuid,
	"customer_id" uuid,
	"user_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"payment_method" text NOT NULL,
	"stripe_payment_id" text,
	"items" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"tour_id" uuid NOT NULL,
	"boat_id" uuid,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"max_participants" integer,
	"price" numeric(10, 2),
	"weather_notes" text,
	"conditions" jsonb,
	"notes" text,
	"staff_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_id" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"trial_ends_at" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"month" text NOT NULL,
	"bookings_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boats" ADD CONSTRAINT "boats_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_sites" ADD CONSTRAINT "dive_sites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_dive_site_id_dive_sites_id_fk" FOREIGN KEY ("dive_site_id") REFERENCES "public"."dive_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_boat_id_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boats_org_idx" ON "boats" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bookings_org_idx" ON "bookings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_number_idx" ON "bookings" USING btree ("organization_id","booking_number");--> statement-breakpoint
CREATE INDEX "bookings_org_trip_idx" ON "bookings" USING btree ("organization_id","trip_id");--> statement-breakpoint
CREATE INDEX "bookings_org_customer_idx" ON "bookings" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "bookings_org_status_idx" ON "bookings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "bookings_org_date_idx" ON "bookings" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customers_org_email_idx" ON "customers" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "customers_org_name_idx" ON "customers" USING btree ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "discount_codes_org_idx" ON "discount_codes" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_org_code_idx" ON "discount_codes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "discount_codes_org_active_idx" ON "discount_codes" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "dive_sites_org_idx" ON "dive_sites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "equipment_org_idx" ON "equipment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "equipment_org_category_idx" ON "equipment" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "equipment_org_status_idx" ON "equipment" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "images_org_idx" ON "images" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "images_org_entity_idx" ON "images" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_org_category_idx" ON "products" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "products_org_sku_idx" ON "products" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "rentals_org_idx" ON "rentals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rentals_org_customer_idx" ON "rentals" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "rentals_org_equipment_idx" ON "rentals" USING btree ("organization_id","equipment_id");--> statement-breakpoint
CREATE INDEX "rentals_org_status_idx" ON "rentals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tour_dive_sites_org_idx" ON "tour_dive_sites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tour_dive_sites_tour_idx" ON "tour_dive_sites" USING btree ("tour_id");--> statement-breakpoint
CREATE INDEX "tours_org_idx" ON "tours" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transactions_org_idx" ON "transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transactions_org_booking_idx" ON "transactions" USING btree ("organization_id","booking_id");--> statement-breakpoint
CREATE INDEX "transactions_org_customer_idx" ON "transactions" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "transactions_org_date_idx" ON "transactions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "trips_org_idx" ON "trips" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trips_org_date_idx" ON "trips" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "trips_org_status_idx" ON "trips" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_status_idx" ON "invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_org_idx" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_customer_idx" ON "subscription" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_subscription_idx" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "usage_tracking_org_idx" ON "usage_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_tracking_org_month_idx" ON "usage_tracking" USING btree ("organization_id","month");