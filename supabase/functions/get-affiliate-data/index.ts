
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommissionMapping {
  [key: string]: {
    viewer_pays: number;
    affiliate_get: number;
  };
}

interface PromoCodeMap {
  [key: string]: string;
}

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

    // Get Stripe API key from environment variables
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY environment variable not set");
      return new Response(
        JSON.stringify({ error: "Stripe API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Product commission mapping from Python script
    const PRODUCT_COMMISSIONS: CommissionMapping = {
      "prod_RINKAvP3L2kZeV": { viewer_pays: 35.10, affiliate_get: 7.80 },
      "prod_RINJvQw1Qw1Qw1Q": { viewer_pays: 42.30, affiliate_get: 9.40 },
      "prod_RINO6yE0y4O9gX": { viewer_pays: 116.10, affiliate_get: 29.80 },
    };

    // Promo code mapping from Python script
    const PROMO_CODES: PromoCodeMap = {
      "nic": "promo_1QyefCCgyJ2z2jNZEZv16p7s",
      "maru": "promo_1QvpMsCgyJ2z2jNZ0IC6vKLk",
    };

    // Helper function to get the product ID from a session
    async function getProductIdFromSession(session: any): Promise<string | null> {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        if (lineItems.data && lineItems.data.length > 0) {
          const item = lineItems.data[0];
          // Get the price object to access the product ID
          if (item.price && item.price.product) {
            return typeof item.price.product === 'string' 
              ? item.price.product 
              : item.price.product.id;
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching line items for session ${session.id}:`, error);
        return null;
      }
    }

    // Calculate start and end date timestamps for the given year and month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate(); // Get last day of month
    const endDate = new Date(parseInt(year), parseInt(month) - 1, lastDay, 23, 59, 59);
    
    console.log(`Fetching data for ${affiliateCode} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // We'll use this to store our commission data
    const commissions = [];
    const customerEmails = new Set();
    let totalRevenue = 0;
    let totalCommission = 0;

    // Special case for ADMIN: Return sample data for demonstration
    if (affiliateCode === "ADMIN") {
      // Add sample data for demonstration purposes
      const sampleDate = new Date();
      
      // Add a few sample commissions
      commissions.push({
        sessionId: "cs_sample_1",
        paymentIntent: "pi_sample_1",
        customerEmail: "customer1@example.com",
        amount: 116.10,
        commission: 29.80,
        date: new Date(sampleDate.getFullYear(), sampleDate.getMonth(), 5).toISOString(),
        productId: "prod_RINO6yE0y4O9gX"
      });
      
      commissions.push({
        sessionId: "cs_sample_2",
        paymentIntent: "pi_sample_2",
        customerEmail: "customer2@example.com",
        amount: 35.10,
        commission: 7.80,
        date: new Date(sampleDate.getFullYear(), sampleDate.getMonth(), 12).toISOString(),
        productId: "prod_RINKAvP3L2kZeV"
      });
      
      commissions.push({
        sessionId: "cs_sample_3",
        paymentIntent: "pi_sample_3",
        customerEmail: "customer3@example.com",
        amount: 42.30,
        commission: 9.40,
        date: new Date(sampleDate.getFullYear(), sampleDate.getMonth(), 20).toISOString(),
        productId: "prod_RINJvQw1Qw1Qw1Q"
      });
      
      // Calculate summary data
      totalRevenue = 193.50; // Sum of all amounts
      totalCommission = 47.00; // Sum of all commissions
      customerEmails.add("customer1@example.com");
      customerEmails.add("customer2@example.com");
      customerEmails.add("customer3@example.com");
      
      console.log(`Returning ${commissions.length} sample commissions for ${affiliateCode}`);
      
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
    } else if (affiliateCode === "ayoub") {
      // Special case for ayoub: all $149 sales without 'nic' or 'maru' code
      // List all checkout sessions within the date range
      const sessions = await stripe.checkout.sessions.list({ 
        limit: 100,
        created: {
          // Convert to seconds for Stripe API
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000)
        },
        expand: ['data.discounts']
      });

      // Process each session
      for (const session of sessions.data) {
        // Skip sessions that aren't paid
        if (session.payment_status !== 'paid') continue;
        
        // Skip if any promo code is used
        const hasPromoCode = session.discounts?.some((discount: any) => 
          Object.values(PROMO_CODES).includes(discount.promotion_code)
        );
        
        if (hasPromoCode) continue;
        
        // Get product ID
        const productId = await getProductIdFromSession(session);
        if (productId !== "prod_RINO6yE0y4O9gX") continue;
        
        // Calculate commission (fixed at $20 for ayoub as per Python script)
        const amount = session.amount_total / 100;
        const commission = 20.0;
        
        // Get customer email
        const customerEmail = session.customer_details?.email || "unknown@example.com";
        customerEmails.add(customerEmail);
        
        // Collect data
        totalRevenue += amount;
        totalCommission += commission;
        
        // Store commission data
        commissions.push({
          sessionId: session.id,
          paymentIntent: session.payment_intent,
          customerEmail,
          amount,
          commission,
          date: new Date(session.created * 1000).toISOString(),
          productId
        });
      }
    } else if (PROMO_CODES[affiliateCode]) {
      // For nic and maru, filter by promo code
      const promoId = PROMO_CODES[affiliateCode];
      
      // List all checkout sessions
      const sessions = await stripe.checkout.sessions.list({ 
        limit: 100,
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000)
        },
        expand: ['data.discounts']
      });
      
      console.log(`Found ${sessions.data.length} sessions in time range`);
      
      // Process each session that has our promo code
      for (const session of sessions.data) {
        // Skip sessions that aren't paid
        if (session.payment_status !== 'paid') continue;
        
        // Check if this session used our promo code
        let hasPromoCode = false;
        
        // Handle both direct discount field and discounts array
        if (session.discounts && session.discounts.length > 0) {
          hasPromoCode = session.discounts.some((discount: any) => 
            discount.promotion_code === promoId
          );
        } else if (session.discount && session.discount.promotion_code === promoId) {
          hasPromoCode = true;
        }
        
        if (!hasPromoCode) continue;
        
        // Get product ID
        const productId = await getProductIdFromSession(session);
        if (!productId) continue;
        
        // Calculate commission based on product
        const amount = session.amount_total / 100;
        let commission = 0;
        
        if (PRODUCT_COMMISSIONS[productId]) {
          commission = PRODUCT_COMMISSIONS[productId].affiliate_get;
        }
        
        // Get customer email
        const customerEmail = session.customer_details?.email || "unknown@example.com";
        customerEmails.add(customerEmail);
        
        // Collect data
        totalRevenue += amount;
        totalCommission += commission;
        
        // Store commission data
        commissions.push({
          sessionId: session.id,
          paymentIntent: session.payment_intent,
          customerEmail,
          amount,
          commission,
          date: new Date(session.created * 1000).toISOString(),
          productId
        });
      }
    } else {
      console.error(`Invalid affiliate code: ${affiliateCode}`);
      return new Response(
        JSON.stringify({ error: "Invalid affiliate code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
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
