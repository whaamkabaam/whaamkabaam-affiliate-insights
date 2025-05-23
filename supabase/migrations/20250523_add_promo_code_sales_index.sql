
-- Add index on promo_code_name to improve affiliate data query performance
CREATE INDEX IF NOT EXISTS idx_promo_code_sales_promo_code_name ON public.promo_code_sales(promo_code_name);

-- Create a system setting record for stripe sync progress if it doesn't exist
INSERT INTO public.system_settings (key, value)
VALUES ('stripe_sync_progress', '{"progress": 0}'::jsonb)
ON CONFLICT (key)
DO NOTHING;
