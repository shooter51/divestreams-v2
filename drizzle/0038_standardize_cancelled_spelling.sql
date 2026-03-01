-- Migration: Standardize 'canceled' -> 'cancelled' spelling in booking and trip status
-- Issue: DS-h8f - Both spellings were used inconsistently in the codebase and database
-- Stripe-related columns (subscription.status, stripe_subscriptions.status) are NOT changed
-- as Stripe's API uses 'canceled' (American English)

UPDATE bookings SET status = 'cancelled' WHERE status = 'canceled';
UPDATE trips SET status = 'cancelled' WHERE status = 'canceled';
UPDATE training_sessions SET status = 'cancelled' WHERE status = 'canceled';
