
-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.admin_get_affiliates();

-- Create a new function with proper error handling and optimization
CREATE OR REPLACE FUNCTION public.admin_get_affiliates()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requesting_user_id uuid;
    is_admin boolean;
    affiliate_record RECORD;
    result json;
BEGIN
    -- Get the ID of the user making the request
    requesting_user_id := auth.uid();
    
    -- Check if the requesting user is an admin
    SELECT EXISTS (
        SELECT 1
        FROM affiliates a
        WHERE a.user_id = requesting_user_id
        AND a.commission_rate >= 0.2
    ) INTO is_admin;
    
    -- If the user is not an admin, return an error
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can access this function';
    END IF;
    
    -- Return affiliate data with their commission metrics
    FOR affiliate_record IN 
        SELECT 
            a.id, 
            a.user_id, 
            u.email, 
            a.affiliate_code,
            a.commission_rate,
            COALESCE(SUM(pcs.affiliate_commission), 0) as total_commission,
            COALESCE(SUM(pcs.amount_paid), 0) as total_sales,
            COALESCE(COUNT(DISTINCT pcs.customer_email), 0) as customer_count,
            a.created_at
        FROM 
            affiliates a
        JOIN 
            auth.users u ON a.user_id = u.id
        LEFT JOIN 
            promo_code_sales pcs ON a.affiliate_code = pcs.promo_code_name
        GROUP BY 
            a.id, a.user_id, u.email, a.affiliate_code, a.commission_rate, a.created_at
        ORDER BY 
            a.created_at DESC
        LIMIT 100
    LOOP
        -- Construct JSON object for each affiliate
        SELECT json_build_object(
            'id', affiliate_record.id,
            'user_id', affiliate_record.user_id,
            'email', affiliate_record.email,
            'affiliate_code', affiliate_record.affiliate_code,
            'commission_rate', affiliate_record.commission_rate,
            'total_commission', affiliate_record.total_commission,
            'total_sales', affiliate_record.total_sales,
            'customer_count', affiliate_record.customer_count,
            'created_at', affiliate_record.created_at
        ) INTO result;
        
        -- Return current row
        RETURN NEXT result;
    END LOOP;
    
    -- Return empty if no records found
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$;

-- Set appropriate permissions
ALTER FUNCTION public.admin_get_affiliates() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_get_affiliates() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_affiliates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_affiliates() FROM service_role;
