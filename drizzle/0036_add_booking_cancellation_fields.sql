-- Migration: Add cancellation tracking fields to bookings table
-- KAN-652: Customer booking cancellation feature

ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp;
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;
