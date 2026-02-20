-- Add barcode field to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

-- Create index for barcode lookups
CREATE INDEX IF NOT EXISTS "products_org_barcode_idx" ON "products" ("organization_id", "barcode");

-- Add barcode field to equipment table
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

-- Create index for equipment barcode lookups
CREATE INDEX IF NOT EXISTS "equipment_org_barcode_idx" ON "equipment" ("organization_id", "barcode");
