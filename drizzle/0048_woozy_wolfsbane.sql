CREATE TYPE "public"."integration_provider" AS ENUM('stripe', 'google-calendar', 'mailchimp', 'quickbooks', 'zapier', 'twilio', 'whatsapp', 'xero');--> statement-breakpoint
CREATE TYPE "public"."quickbooks_sync_entity" AS ENUM('customer', 'invoice', 'payment', 'item');--> statement-breakpoint
CREATE TYPE "public"."quickbooks_sync_status" AS ENUM('pending', 'synced', 'failed', 'deleted');--> statement-breakpoint
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
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"source" text DEFAULT 'direct',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text DEFAULT 'email' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp,
	"sent_by" text,
	"email_from" text,
	"email_to" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"has_account" boolean DEFAULT false NOT NULL,
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
	"barcode" text,
	"size" text,
	"status" text DEFAULT 'available' NOT NULL,
	"condition" text DEFAULT 'good',
	"rental_price" numeric(10, 2),
	"is_rentable" boolean DEFAULT true,
	"is_public" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"boat_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"cost" numeric(10, 2),
	"notes" text,
	"next_maintenance_date" date,
	"next_maintenance_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_name" text DEFAULT 'Tax',
	"tax_included_in_price" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL,
	"time_format" text DEFAULT '12h' NOT NULL,
	"require_deposit_for_booking" boolean DEFAULT false NOT NULL,
	"deposit_percentage" numeric(5, 2) DEFAULT '0',
	"cancellation_policy_days" integer DEFAULT 7,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "page_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text NOT NULL,
	"content" jsonb NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	"published_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_content_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_content_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_quantity_non_negative" CHECK ("products"."stock_quantity" >= 0)
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
CREATE TABLE "service_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"equipment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"performed_by" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"cost" numeric(10, 2),
	"notes" text,
	"certification_expiry" date,
	"next_service_date" date,
	"next_service_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"monthly_price_id" text,
	"yearly_price_id" text,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"features" jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"admin_modified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subdomain" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_id" uuid,
	"subscription_status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp,
	"current_period_end" timestamp,
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"schema_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "tenants_schema_name_unique" UNIQUE("schema_name")
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
	"refunded_transaction_id" uuid,
	"refund_reason" text,
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
	"is_public" boolean DEFAULT false NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_pattern" text,
	"recurrence_days" jsonb,
	"recurrence_end_date" date,
	"recurrence_count" integer,
	"recurring_template_id" uuid,
	"recurrence_index" integer,
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
	"force_password_change" boolean DEFAULT false,
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
	"custom_domain" text,
	"public_site_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_name_unique" UNIQUE("name"),
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
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
	"plan" text DEFAULT 'standard' NOT NULL,
	"plan_id" uuid NOT NULL,
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
CREATE TABLE "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"external_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"account_id" text,
	"account_name" text,
	"account_email" text,
	"settings" jsonb,
	"scopes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_item_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" uuid NOT NULL,
	"divestreams_product_type" text NOT NULL,
	"divestreams_product_id" text,
	"quickbooks_item_id" text NOT NULL,
	"quickbooks_item_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_sync_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" uuid NOT NULL,
	"entity_type" "quickbooks_sync_entity" NOT NULL,
	"divestreams_id" text NOT NULL,
	"quickbooks_id" text NOT NULL,
	"sync_status" "quickbooks_sync_status" DEFAULT 'synced' NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"referrer_page" text,
	"user_agent" text,
	"ip_address" text,
	"status" text DEFAULT 'new' NOT NULL,
	"replied_at" timestamp,
	"replied_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"verification_token_expires" timestamp,
	"reset_token" text,
	"reset_token_expires" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "agency_course_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid,
	"level_id" uuid,
	"agency_code" text,
	"level_code" text,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"images" jsonb,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"classroom_hours" integer DEFAULT 0,
	"pool_hours" integer DEFAULT 0,
	"open_water_dives" integer DEFAULT 0,
	"prerequisites" text,
	"min_age" integer,
	"medical_requirements" text,
	"required_items" jsonb,
	"materials_included" boolean DEFAULT true,
	"content_hash" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"website" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"agency_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"level_number" integer DEFAULT 1 NOT NULL,
	"description" text,
	"prerequisites" text,
	"min_age" integer,
	"min_dives" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"agency_id" uuid,
	"level_id" uuid,
	"template_id" uuid,
	"template_hash" text,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"classroom_hours" integer DEFAULT 0,
	"pool_hours" integer DEFAULT 0,
	"open_water_dives" integer DEFAULT 0,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deposit_required" boolean DEFAULT false,
	"deposit_amount" numeric(10, 2),
	"min_students" integer DEFAULT 1,
	"max_students" integer DEFAULT 6 NOT NULL,
	"materials_included" boolean DEFAULT true,
	"equipment_included" boolean DEFAULT true,
	"included_items" jsonb,
	"required_items" jsonb,
	"min_age" integer,
	"prerequisites" text,
	"required_cert_level" uuid,
	"medical_requirements" text,
	"images" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"series_id" uuid,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"progress" jsonb,
	"skill_checkoffs" jsonb,
	"certification_number" text,
	"certification_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_session_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"max_students" integer,
	"price_override" numeric(10, 2),
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"instructor_id" text,
	"instructor_name" text,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"series_id" uuid,
	"series_index" integer,
	"session_type" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"location" text,
	"meeting_point" text,
	"instructor_id" text,
	"instructor_name" text,
	"max_students" integer,
	"price_override" numeric(10, 2),
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"bio" text,
	"image_url" text,
	"email" text,
	"phone" text,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"years_experience" integer,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_change_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changed_by_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"method" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_customers_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"invoice_number" text,
	"amount_due" integer NOT NULL,
	"amount_paid" integer NOT NULL,
	"amount_remaining" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"total" integer NOT NULL,
	"tax" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp,
	"hosted_invoice_url" text,
	"invoice_pdf" text,
	"description" text,
	"line_items" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_invoice_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"payment_method_type" text,
	"payment_method_brand" text,
	"payment_method_last4" text,
	"failure_code" text,
	"failure_message" text,
	"receipt_email" text,
	"receipt_url" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" text NOT NULL,
	"plan_name" text,
	"plan_interval" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "zapier_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"label" text,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zapier_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "zapier_webhook_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb NOT NULL,
	"target_url" text NOT NULL,
	"http_status" integer,
	"response_body" text,
	"error_message" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zapier_webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"event_type" text NOT NULL,
	"target_url" text NOT NULL,
	"filters" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"last_error" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"completed_tasks" jsonb DEFAULT '[]'::jsonb,
	"dismissed" boolean DEFAULT false,
	"dismissed_at" timestamp,
	"current_section" text,
	"tour_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boats" ADD CONSTRAINT "boats_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communications" ADD CONSTRAINT "customer_communications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communications" ADD CONSTRAINT "customer_communications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_sites" ADD CONSTRAINT "dive_sites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_boat_id_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."boats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_content_history" ADD CONSTRAINT "page_content_history_page_content_id_page_content_id_fk" FOREIGN KEY ("page_content_id") REFERENCES "public"."page_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_content_history" ADD CONSTRAINT "page_content_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_dive_sites" ADD CONSTRAINT "tour_dive_sites_dive_site_id_dive_sites_id_fk" FOREIGN KEY ("dive_site_id") REFERENCES "public"."dive_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_refunded_transaction_id_transactions_id_fk" FOREIGN KEY ("refunded_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_log" ADD CONSTRAINT "integration_sync_log_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_item_mappings" ADD CONSTRAINT "quickbooks_item_mappings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_item_mappings" ADD CONSTRAINT "quickbooks_item_mappings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_sync_records" ADD CONSTRAINT "quickbooks_sync_records_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_sync_records" ADD CONSTRAINT "quickbooks_sync_records_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credentials" ADD CONSTRAINT "customer_credentials_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_course_templates" ADD CONSTRAINT "agency_course_templates_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_course_templates" ADD CONSTRAINT "agency_course_templates_level_id_certification_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."certification_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_agencies" ADD CONSTRAINT "certification_agencies_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certification_levels" ADD CONSTRAINT "certification_levels_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_agency_id_certification_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."certification_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_level_id_certification_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."certification_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_template_id_agency_course_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."agency_course_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_required_cert_level_certification_levels_id_fk" FOREIGN KEY ("required_cert_level") REFERENCES "public"."certification_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_series_id_training_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."training_session_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_series" ADD CONSTRAINT "training_session_series_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_series" ADD CONSTRAINT "training_session_series_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_series_id_training_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."training_session_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_album_id_gallery_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_change_audit" ADD CONSTRAINT "password_change_audit_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_change_audit" ADD CONSTRAINT "password_change_audit_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_change_audit" ADD CONSTRAINT "password_change_audit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zapier_api_keys" ADD CONSTRAINT "zapier_api_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zapier_webhook_delivery_log" ADD CONSTRAINT "zapier_webhook_delivery_log_subscription_id_zapier_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."zapier_webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "zapier_webhook_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boats_org_idx" ON "boats" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bookings_org_idx" ON "bookings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_number_idx" ON "bookings" USING btree ("organization_id","booking_number");--> statement-breakpoint
CREATE INDEX "bookings_org_trip_idx" ON "bookings" USING btree ("organization_id","trip_id");--> statement-breakpoint
CREATE INDEX "bookings_org_customer_idx" ON "bookings" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "bookings_org_status_idx" ON "bookings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "bookings_org_date_idx" ON "bookings" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_communications_org_idx" ON "customer_communications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_communications_customer_idx" ON "customer_communications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_communications_type_idx" ON "customer_communications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_email_idx" ON "customers" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "customers_org_name_idx" ON "customers" USING btree ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "discount_codes_org_idx" ON "discount_codes" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_org_code_idx" ON "discount_codes" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "discount_codes_org_active_idx" ON "discount_codes" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "dive_sites_org_idx" ON "dive_sites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "equipment_org_idx" ON "equipment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "equipment_org_category_idx" ON "equipment" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "equipment_org_status_idx" ON "equipment" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "equipment_org_barcode_idx" ON "equipment" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE INDEX "images_org_idx" ON "images" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "images_org_entity_idx" ON "images" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "maintenance_logs_org_idx" ON "maintenance_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "maintenance_logs_boat_idx" ON "maintenance_logs" USING btree ("boat_id");--> statement-breakpoint
CREATE INDEX "maintenance_logs_performed_at_idx" ON "maintenance_logs" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "page_content_org_idx" ON "page_content" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_content_org_page_idx" ON "page_content" USING btree ("organization_id","page_id");--> statement-breakpoint
CREATE INDEX "page_content_status_idx" ON "page_content" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "page_content_published_idx" ON "page_content" USING btree ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX "page_history_page_idx" ON "page_content_history" USING btree ("page_content_id");--> statement-breakpoint
CREATE INDEX "page_history_org_idx" ON "page_content_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "page_history_version_idx" ON "page_content_history" USING btree ("page_content_id","version");--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_org_category_idx" ON "products" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "products_org_sku_idx" ON "products" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "products_org_barcode_idx" ON "products" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE INDEX "rentals_org_idx" ON "rentals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rentals_org_customer_idx" ON "rentals" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "rentals_org_equipment_idx" ON "rentals" USING btree ("organization_id","equipment_id");--> statement-breakpoint
CREATE INDEX "rentals_org_status_idx" ON "rentals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "service_records_org_idx" ON "service_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_records_equipment_idx" ON "service_records" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "service_records_performed_at_idx" ON "service_records" USING btree ("performed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "tenants_stripe_customer_idx" ON "tenants" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "tour_dive_sites_org_idx" ON "tour_dive_sites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tour_dive_sites_tour_idx" ON "tour_dive_sites" USING btree ("tour_id");--> statement-breakpoint
CREATE INDEX "tours_org_idx" ON "tours" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tours_org_name_idx" ON "tours" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "transactions_org_idx" ON "transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transactions_org_booking_idx" ON "transactions" USING btree ("organization_id","booking_id");--> statement-breakpoint
CREATE INDEX "transactions_org_customer_idx" ON "transactions" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "transactions_org_date_idx" ON "transactions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "trips_org_idx" ON "trips" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trips_org_date_idx" ON "trips" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "trips_org_status_idx" ON "trips" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "trips_org_date_status_idx" ON "trips" USING btree ("organization_id","date","status");--> statement-breakpoint
CREATE INDEX "trips_recurring_template_idx" ON "trips" USING btree ("recurring_template_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_status_idx" ON "invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitation_inviter_id_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_org_idx" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "member_org_role_idx" ON "member" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organization_name_idx" ON "organization" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_custom_domain_idx" ON "organization" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "verification" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_customer_idx" ON "subscription" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_subscription_idx" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_plan_id_idx" ON "subscription" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "usage_tracking_org_idx" ON "usage_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_tracking_org_month_idx" ON "usage_tracking" USING btree ("organization_id","month");--> statement-breakpoint
CREATE INDEX "integration_sync_log_integration_idx" ON "integration_sync_log" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "integration_sync_log_status_idx" ON "integration_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_sync_log_created_idx" ON "integration_sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_org_provider_idx" ON "integrations" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "integrations_org_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integrations_provider_idx" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integrations_active_idx" ON "integrations" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "qb_mapping_org_idx" ON "quickbooks_item_mappings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "qb_mapping_integration_idx" ON "quickbooks_item_mappings" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "qb_mapping_product_idx" ON "quickbooks_item_mappings" USING btree ("organization_id","divestreams_product_type","divestreams_product_id");--> statement-breakpoint
CREATE INDEX "qb_sync_org_entity_idx" ON "quickbooks_sync_records" USING btree ("organization_id","entity_type","divestreams_id");--> statement-breakpoint
CREATE INDEX "qb_sync_integration_idx" ON "quickbooks_sync_records" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "qb_sync_status_idx" ON "quickbooks_sync_records" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "qb_sync_quickbooks_id_idx" ON "quickbooks_sync_records" USING btree ("quickbooks_id");--> statement-breakpoint
CREATE INDEX "contact_messages_org_idx" ON "contact_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_messages_org_status_idx" ON "contact_messages" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "contact_messages_org_created_idx" ON "contact_messages" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_email_idx" ON "contact_messages" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_creds_org_idx" ON "customer_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_creds_org_email_idx" ON "customer_credentials" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "customer_creds_customer_idx" ON "customer_credentials" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_org_idx" ON "customer_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_token_idx" ON "customer_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "customer_sessions_expires_idx" ON "customer_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_agency_templates_agency" ON "agency_course_templates" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "idx_agency_templates_agency_code" ON "agency_course_templates" USING btree ("agency_code");--> statement-breakpoint
CREATE INDEX "idx_agency_templates_hash" ON "agency_course_templates" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agency_templates_unique_code" ON "agency_course_templates" USING btree ("agency_code","code");--> statement-breakpoint
CREATE INDEX "cert_agencies_org_idx" ON "certification_agencies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_agencies_org_code_idx" ON "certification_agencies" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cert_levels_org_idx" ON "certification_levels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cert_levels_agency_idx" ON "certification_levels" USING btree ("agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_levels_org_code_idx" ON "certification_levels" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "cert_levels_org_active_idx" ON "certification_levels" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "training_courses_org_idx" ON "training_courses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_courses_agency_idx" ON "training_courses" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "training_courses_level_idx" ON "training_courses" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "training_courses_template_idx" ON "training_courses" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "training_courses_public_idx" ON "training_courses" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "training_enrollments_org_idx" ON "training_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_session_idx" ON "training_enrollments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_customer_idx" ON "training_enrollments" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_enrollments_unique_idx" ON "training_enrollments" USING btree ("session_id","customer_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_org_status_idx" ON "training_enrollments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "training_series_org_idx" ON "training_session_series" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_series_course_idx" ON "training_session_series" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_series_status_idx" ON "training_session_series" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "training_sessions_org_idx" ON "training_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "training_sessions_course_idx" ON "training_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "training_sessions_series_idx" ON "training_sessions" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "training_sessions_date_idx" ON "training_sessions" USING btree ("organization_id","start_date");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "gallery_albums_org_idx" ON "gallery_albums" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_albums_org_slug_idx" ON "gallery_albums" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "gallery_albums_public_idx" ON "gallery_albums" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "gallery_images_org_idx" ON "gallery_images" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gallery_images_album_idx" ON "gallery_images" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "gallery_images_category_idx" ON "gallery_images" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "gallery_images_featured_idx" ON "gallery_images" USING btree ("organization_id","is_featured");--> statement-breakpoint
CREATE INDEX "gallery_images_status_idx" ON "gallery_images" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "gallery_images_trip_idx" ON "gallery_images" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "team_members_org_idx" ON "team_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "team_members_org_public_idx" ON "team_members" USING btree ("organization_id","is_public");--> statement-breakpoint
CREATE INDEX "team_members_org_status_idx" ON "team_members" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "team_members_display_order_idx" ON "team_members" USING btree ("organization_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_password_audit_target" ON "password_change_audit" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_password_audit_changed_by" ON "password_change_audit" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_password_audit_org" ON "password_change_audit" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_password_audit_created" ON "password_change_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stripe_customers_org_idx" ON "stripe_customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_customers_stripe_id_idx" ON "stripe_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_invoices_org_idx" ON "stripe_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_invoices_stripe_id_idx" ON "stripe_invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_invoices_customer_idx" ON "stripe_invoices" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_invoices_subscription_idx" ON "stripe_invoices" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "stripe_invoices_status_idx" ON "stripe_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_invoices_created_idx" ON "stripe_invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stripe_payments_org_idx" ON "stripe_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_payments_intent_idx" ON "stripe_payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "stripe_payments_customer_idx" ON "stripe_payments" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_payments_invoice_idx" ON "stripe_payments" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_payments_status_idx" ON "stripe_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_payments_created_idx" ON "stripe_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_org_idx" ON "stripe_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_stripe_id_idx" ON "stripe_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_customer_idx" ON "stripe_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zapier_api_keys_org_idx" ON "zapier_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "zapier_api_keys_active_idx" ON "zapier_api_keys" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "zapier_delivery_log_subscription_idx" ON "zapier_webhook_delivery_log" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "zapier_delivery_log_status_idx" ON "zapier_webhook_delivery_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zapier_delivery_log_created_idx" ON "zapier_webhook_delivery_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "zapier_webhooks_org_idx" ON "zapier_webhook_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "zapier_webhooks_event_idx" ON "zapier_webhook_subscriptions" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "zapier_webhooks_active_idx" ON "zapier_webhook_subscriptions" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "onboarding_progress_user_id_idx" ON "onboarding_progress" USING btree ("user_id");