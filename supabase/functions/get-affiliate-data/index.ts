
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Handle special case for checking if Stripe key is configured
    if (requestData.checkKey === true) {
      const hasKey = !!Deno.env.get("STRIPE_SECRET_KEY");
      return new Response(
        JSON.stringify({ hasKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Extract and validate parameters
    const { affiliateCode, year, month } = requestData;
    
    if (!affiliateCode) {
      console.error("Missing affiliateCode parameter");
      return new Response(
        JSON.stringify({ error: "Missing affiliateCode parameter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!year || !month) {
      console.error("Missing year or month parameter");
      return new Response(
        JSON.stringify({ error: "Missing year or month parameter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create Supabase client using service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Calculate start and end date timestamps for the given year and month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate(); // Get last day of month
    const endDate = new Date(parseInt(year), parseInt(month) - 1, lastDay, 23, 59, 59);
    
    console.log(`Fetching data for ${affiliateCode} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Track customer emails for counting unique customers
    const customerEmails = new Set();
    let totalRevenue = 0;
    let totalCommission = 0;
    const commissions = [];

    if (affiliateCode === "ayoub") {
      // Special case for ayoub: all $149 sales without 'nic' or 'maru' code
      // This case can be handled with a specific query on promo_code_sales
      const { data, error } = await supabaseClient
        .from('promo_code_sales')
        .select('*')
        .is('promo_code_name', null) // No affiliate code
        .eq('product_id', 'prod_RINO6yE0y4O9gX') // Only enterprise membership
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
        
      if (error) {
        console.error("Error fetching sales data:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // Process sales data
      if (data && data.length > 0) {
        for (const sale of data) {
          // Use fixed commission for ayoub as per original logic
          const commission = 20.0;
          
          if (sale.customer_email) {
            customerEmails.add(sale.customer_email);
          }
          
          totalRevenue += Number(sale.amount_paid);
          totalCommission += commission;
          
          commissions.push({
            sessionId: sale.session_id,
            paymentIntent: sale.payment_intent_id,
            customerEmail: sale.customer_email || "unknown@example.com",
            amount: Number(sale.amount_paid),
            commission,
            date: sale.created_at,
            productId: sale.product_id
          });
        }
      }
    } else {
      // For all other affiliates, query based on promo_code_name
      const { data, error } = await supabaseClient
        .from('promo_code_sales')
        .select('*')
        .eq('promo_code_name', affiliateCode)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (error) {
        console.error("Error fetching sales data:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // Process sales data
      if (data && data.length > 0) {
        for (const sale of data) {
          if (sale.customer_email) {
            customerEmails.add(sale.customer_email);
          }
          
          const amount = Number(sale.amount_paid);
          const commission = Number(sale.affiliate_commission || 0);
          
          totalRevenue += amount;
          totalCommission += commission;
          
          commissions.push({
            sessionId: sale.session_id,
            paymentIntent: sale.payment_intent_id,
            customerEmail: sale.customer_email || "unknown@example.com",
            amount,
            commission,
            date: sale.created_at,
            productId: sale.product_id
          });
        }
      }
    }

    console.log(`Returning ${commissions.length} commissions for ${affiliateCode}`);
    
    // Return compiled data
    return new Response(
      JSON.stringify({
        commissions,
        summary: {
          totalRevenue,
          totalCommission,
          customerCount: customerEmails.size
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
