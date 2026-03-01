-- Migration: Add rentals table to PUBLIC schema (for getTenantDb compatibility)
-- The original migration 0001 created rentals in PUBLIC schema
-- Code uses getTenantDb() which currently reads from PUBLIC
-- This migration ensures the table exists and has correct structure

CREATE TABLE IF NOT EXISTS public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id text NOT NULL,
  transaction_id uuid,
  customer_id uuid NOT NULL,
  equipment_id uuid NOT NULL,
  rented_at timestamp DEFAULT now() NOT NULL,
  due_at timestamp NOT NULL,
  returned_at timestamp,
  daily_rate numeric(10, 2) NOT NULL,
  total_charge numeric(10, 2) NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  agreement_number text NOT NULL,
  agreement_signed_at timestamp,
  agreement_signed_by text,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL,

  -- Foreign keys
  CONSTRAINT rentals_org_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE,
  CONSTRAINT rentals_trans_fk FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE NO ACTION,
  CONSTRAINT rentals_cust_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE NO ACTION,
  CONSTRAINT rentals_equip_fk FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE NO ACTION
);

-- Create indexes
CREATE INDEX IF NOT EXISTS rentals_org_idx ON public.rentals (organization_id);
CREATE INDEX IF NOT EXISTS rentals_org_customer_idx ON public.rentals (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS rentals_org_equipment_idx ON public.rentals (organization_id, equipment_id);
CREATE INDEX IF NOT EXISTS rentals_org_status_idx ON public.rentals (organization_id, status);
