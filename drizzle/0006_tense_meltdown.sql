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
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_org_idx" ON "contact_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_messages_org_status_idx" ON "contact_messages" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "contact_messages_org_created_idx" ON "contact_messages" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_email_idx" ON "contact_messages" USING btree ("email");