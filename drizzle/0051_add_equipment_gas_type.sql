ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "gas_type" text;
-- Default existing tanks to 'air'
UPDATE "equipment" SET "gas_type" = 'air' WHERE "category" = 'tank' AND "gas_type" IS NULL;
