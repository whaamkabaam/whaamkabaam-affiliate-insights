import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { year, month, forceRefresh = false } = requestData;

    console.log(`Syncing Stripe data for ${year}-${month}, forceRefresh: ${forceRefresh}`);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Calculate Unix timestamps for the date range
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    console.log(`Fetching Stripe sessions from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Unix timestamps: ${startTimestamp} to ${endTimestamp}`);

    // Check if we need to refresh data
    let shouldSync = forceRefresh;
    
    if (!shouldSync) {
      const { data: lastSync } = await supabaseClient
        .from('system_settings')
        .select('value, updated_at')
        .eq('key', `stripe_sync_${year}_${month}`)
        .single();

      if (!lastSync) {
        shouldSync = true;
        console.log("No previous sync found, will sync");
      } else {
        const lastSyncTime = new Date(lastSync.updated_at);
        const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
        shouldSync = hoursSinceSync > 1;
        console.log(`Last sync: ${lastSyncTime.toISOString()}, hours ago: ${hoursSinceSync.toFixed(2)}`);
      }
    }

    if (!shouldSync) {
      console.log("Data is recent, skipping sync");
      return new Response(
        JSON.stringify({ 
          message: "Data is recent, no sync needed",
          lastSync: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting Stripe data sync...");

    // Get affiliate mapping from database including commission rates
    const { data: affiliates, error: affiliateError } = await supabaseClient
      .from('affiliates')
      .select('affiliate_code, stripe_promotion_code_id, commission_rate');

    if (affiliateError) {
      console.error("Error fetching affiliates:", affiliateError);
      throw affiliateError;
    }

    // Create mapping from Stripe promotion code to internal affiliate data
    const stripeToAffiliateMap: Record<string, { code: string; rate: number }> = {};
    if (affiliates) {
      for (const affiliate of affiliates) {
        if (affiliate.stripe_promotion_code_id) {
          stripeToAffiliateMap[affiliate.stripe_promotion_code_id] = {
            code: affiliate.affiliate_code,
            rate: Number(affiliate.commission_rate) || 0.1
          };
        }
      }
    }

    console.log("Affiliate mapping:", stripeToAffiliateMap);

    // Fetch checkout sessions from Stripe with date filtering
    const stripeUrl = `https://api.stripe.com/v1/checkout/sessions?created[gte]=${startTimestamp}&created[lte]=${endTimestamp}&expand[]=data.discounts&expand[]=data.line_items&limit=100`;
    
    let allSessions = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const url = startingAfter 
        ? `${stripeUrl}&starting_after=${startingAfter}`
        : stripeUrl;

      console.log(`Fetching from Stripe: ${url}`);

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Stripe API error: ${response.status} - ${errorText}`);
        throw new Error(`Stripe API error: ${response.status}`);
      }

      const data = await response.json();
      allSessions.push(...data.data);
      
      hasMore = data.has_more;
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id;
      }
      
      console.log(`Fetched ${data.data.length} sessions, total so far: ${allSessions.length}`);
    }

    console.log(`Total sessions fetched: ${allSessions.length}`);

    // Process sessions and extract affiliate commission data
    const commissionRecords = [];
    let processedCount = 0;

    for (const session of allSessions) {
      try {
        // Check if session has affiliate discount
        let stripePromotionCodeId = null;
        let affiliateData = null;
        
        if (session.discounts && session.discounts.length > 0) {
          for (const discount of session.discounts) {
            if (discount.promotion_code) {
              stripePromotionCodeId = discount.promotion_code;
              break;
            } else if (discount.coupon && discount.coupon.id) {
              stripePromotionCodeId = discount.coupon.id;
              break;
            }
          }
        }

        // Skip sessions without promo codes
        if (!stripePromotionCodeId) {
          continue;
        }

        // Map Stripe promotion code to internal affiliate data
        affiliateData = stripeToAffiliateMap[stripePromotionCodeId];
        
        if (!affiliateData) {
          console.log(`No affiliate mapping found for Stripe promotion code: ${stripePromotionCodeId}`);
          continue;
        }

        console.log(`Found affiliate session: ${session.id} -> ${affiliateData.code} (${stripePromotionCodeId})`);

        // Calculate commission using the affiliate's specific rate
        const amountPaid = (session.amount_total || 0) / 100;
        const affiliateCommission = amountPaid * affiliateData.rate;
        
        console.log(`Calculated commission for ${affiliateData.code}: ${amountPaid} * ${affiliateData.rate} = ${affiliateCommission}`);

        const record = {
          session_id: session.id,
          payment_intent_id: session.payment_intent || null,
          customer_email: session.customer_details?.email || null,
          amount_paid: amountPaid,
          affiliate_commission: affiliateCommission,
          promo_code_name: affiliateData.code,
          promo_code_id: stripePromotionCodeId,
          product_id: session.line_items?.data?.[0]?.price?.product || null,
          product_name: session.line_items?.data?.[0]?.description || null,
          created_at: new Date(session.created * 1000).toISOString(),
          refreshed_at: new Date().toISOString()
        };

        commissionRecords.push(record);
        processedCount++;

        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} affiliate sessions`);
        }

      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
      }
    }

    console.log(`Found ${commissionRecords.length} affiliate commission records`);

    // Save commission records to database using batch upserts
    if (commissionRecords.length > 0) {
      const batchSize = 50;
      let savedCount = 0;

      for (let i = 0; i < commissionRecords.length; i += batchSize) {
        const batch = commissionRecords.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabaseClient
          .from('promo_code_sales')
          .upsert(batch, {
            onConflict: 'session_id'
          });

        if (upsertError) {
          console.error('Error saving batch:', upsertError);
          throw upsertError;
        }

        savedCount += batch.length;
        console.log(`Saved batch ${Math.ceil((i + 1) / batchSize)}, total saved: ${savedCount}`);
      }
    }

    // Update sync tracking
    await supabaseClient
      .from('system_settings')
      .upsert({
        key: `stripe_sync_${year}_${month}`,
        value: {
          sessionsProcessed: allSessions.length,
          commissionsFound: commissionRecords.length,
          timestamp: new Date().toISOString()
        }
      });

    console.log(`Sync completed: ${allSessions.length} sessions processed, ${commissionRecords.length} commissions saved`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionsProcessed: allSessions.length,
        commissionsFound: commissionRecords.length,
        message: `Successfully synced ${commissionRecords.length} affiliate commissions`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});
