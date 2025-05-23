
-- Add index on promo_code_name to optimize admin_get_affiliates queries
CREATE INDEX IF NOT EXISTS promo_code_sales_promo_code_name_idx ON public.promo_code_sales (promo_code_name);
