-- Add CHECK constraint to prevent negative stock quantities
-- Related to: KAN-620 - Bulk update product stock allows setting to negative values
ALTER TABLE "products" ADD CONSTRAINT "stock_quantity_non_negative" CHECK ("stock_quantity" >= 0);
