
-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.admin_get_affiliates();

-- Create a new function with proper error handling
CREATE OR REPLACE FUNCTION public.admin_get_affiliates()
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requesting_user_id uuid;
    is_admin boolean;
BEGIN
    -- Get the ID of the user making the request
    requesting_user_id := auth.uid();
    
    -- Check if the requesting user is an admin
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = requesting_user_id
        AND role = 'admin'
    ) INTO is_admin;
    
    -- If the user is not an admin, return an error
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can access this function';
    END IF;
    
    -- Return affiliate data with their commission metrics
    RETURN QUERY
    SELECT json_build_object(
        'id', a.id,
        'user_id', a.user_id,
        'email', auth.users.email,
        'affiliate_code', a.affiliate_code,
        'commission_rate', a.commission_rate,
        'total_commission', 0::numeric, -- Placeholder for commission data
        'total_sales', 0::numeric, -- Placeholder for sales data
        'customer_count', 0::numeric, -- Placeholder for customer count
        'created_at', a.created_at
    )
    FROM affiliates a
    JOIN auth.users ON a.user_id = auth.users.id
    ORDER BY a.created_at DESC;
END;
$$;

-- Set appropriate permissions
ALTER FUNCTION public.admin_get_affiliates() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_get_affiliates() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_affiliates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_affiliates() FROM service_role;
