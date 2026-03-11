-- Migration: Add tank & gas selection support
-- Adds requiresTankSelection to tours table
-- Bookings participantDetails and equipmentRental JSONB types are schema-only changes (no DDL needed)

ALTER TABLE tours ADD COLUMN IF NOT EXISTS requires_tank_selection BOOLEAN NOT NULL DEFAULT FALSE;
