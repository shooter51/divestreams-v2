-- DS-8p6q: Add booking_number_sequences table
-- Replaces the full-table scan in getNextBookingNumber() with an atomic
-- sequence row per organization (UPDATE next_number + 1 RETURNING).
CREATE TABLE IF NOT EXISTS "booking_number_sequences" (
  "organization_id" text NOT NULL PRIMARY KEY
    REFERENCES "organization"("id") ON DELETE CASCADE,
  "next_number"     integer NOT NULL DEFAULT 1000,
  "updated_at"      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "booking_num_seq_org_idx"
  ON "booking_number_sequences" ("organization_id");
