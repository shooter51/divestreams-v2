-- Add refund tracking fields to transactions table
ALTER TABLE "transactions" ADD COLUMN "refunded_transaction_id" uuid;
ALTER TABLE "transactions" ADD COLUMN "refund_reason" text;

-- Add foreign key constraint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_refunded_transaction_id_transactions_id_fk"
  FOREIGN KEY ("refunded_transaction_id") REFERENCES "transactions"("id") ON DELETE set null ON UPDATE no action;

-- Add comment explaining the new fields
COMMENT ON COLUMN "transactions"."refunded_transaction_id" IS 'Reference to the original transaction being refunded (for refund transactions)';
COMMENT ON COLUMN "transactions"."refund_reason" IS 'Reason for the refund (e.g., product return, service cancellation, customer request)';
