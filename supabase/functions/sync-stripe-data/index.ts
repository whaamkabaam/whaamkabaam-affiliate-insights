
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

  // Constants for Ayoub's commission logic
  const AYOUB_AFFILIATE_CODE = "ayoub";
  const AYOUB_COACHING_PRODUCT_ID = "prod_RINO6yE0y4O9gX"; // Confirmed this is correct
  const AYOUB_FLAT_COMMISSION = 20; // $20
  const AYOUB_ALLOWED_PROMO_IDS_FOR_FLAT_COMMISSION = [ // Specific promo IDs for Ayoub's $20 flat rate
    "promo_1QccV9CgyJ2z2jNZBnSTn73U",
    "promo_1QccV9CgyJ2z2jNZpn1g55Dm",
    "promo_1QccV9CgyJ2z2jNZ5NxQQDGO",
    "promo_1QccV9CgyJ2z2jNZMLVi7Lv7"
  ];
  const AYOUB_START_DATE = new Date("2025-05-20T00:00:00Z"); // Ayoub's affiliate program start date

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
      // Check when we last synced this period
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
        shouldSync = hoursSinceSync > 1; // Sync if more than 1 hour old
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

    // Get affiliate mapping from database
    const { data: affiliates, error: affiliateError } = await supabaseClient
      .from('affiliates')
      .select('affiliate_code, stripe_promotion_code_id');

    if (affiliateError) {
      console.error("Error fetching affiliates:", affiliateError);
      throw affiliateError;
    }

    // Create mapping from Stripe promotion code to internal affiliate code
    const stripeToAffiliateMap: Record<string, string> = {};
    if (affiliates) {
      for (const affiliate of affiliates) {
        if (affiliate.stripe_promotion_code_id) {
          stripeToAffiliateMap[affiliate.stripe_promotion_code_id] = affiliate.affiliate_code;
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
        const sessionDate = new Date(session.created * 1000);
        const actualProductIdInSession = session.line_items?.data?.[0]?.price?.product || null;
        
        console.log(`Processing session ${session.id}: Product ${actualProductIdInSession}, Date: ${sessionDate.toISOString()}, Customer: ${session.customer_details?.email || 'unknown'}`);
        
        // Check if session has affiliate discount
        let stripePromotionCodeId = null;
        let affiliateCode = null;
        
        if (session.discounts && session.discounts.length > 0) {
          for (const discount of session.discounts) {
            // Try to get promotion code from different possible fields
            if (discount.promotion_code) {
              stripePromotionCodeId = discount.promotion_code;
              break;
            } else if (discount.coupon && discount.coupon.id) {
              stripePromotionCodeId = discount.coupon.id;
              break;
            }
          }
        }

        // Handle Ayoub's special case: ONLY coaching product sales without discount codes after his start date
        if (!stripePromotionCodeId && 
            actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID && 
            sessionDate >= AYOUB_START_DATE) {
          // This is a coaching product sale with no discount code after Ayoub's start date
          console.log(`Found coaching product sale without discount code on ${sessionDate.toISOString()}, assigning to Ayoub`);
          affiliateCode = AYOUB_AFFILIATE_CODE;
          stripePromotionCodeId = "no_discount_ayoub_coaching"; // Special identifier for tracking
        } else if (stripePromotionCodeId) {
          // Map Stripe promotion code to internal affiliate code
          affiliateCode = stripeToAffiliateMap[stripePromotionCodeId];
        }
        
        // Skip sessions without affiliate assignment
        if (!affiliateCode) {
          console.log(`No affiliate assignment for session ${session.id}, skipping`);
          continue;
        }

        console.log(`Found affiliate session: ${session.id} -> ${affiliateCode} (${stripePromotionCodeId || 'no discount'}) for product ${actualProductIdInSession}`);

        // --- Updated commission logic for Ayoub's date filter ---
        const amountPaid = (session.amount_total || 0) / 100;
        let affiliateCommission = 0;

        if (affiliateCode === AYOUB_AFFILIATE_CODE) {
          // Check if session is after Ayoub's start date
          if (sessionDate < AYOUB_START_DATE) {
            console.log(`SyncStripe: Ayoub session ${session.id} is before start date ${AYOUB_START_DATE.toISOString()}, skipping commission.`);
            affiliateCommission = 0;
          } else {
            console.log(`SyncStripe: Processing session ${session.id} for AYOUB. Product: ${actualProductIdInSession}. Promo code on session: ${stripePromotionCodeId || 'none'}. Date: ${sessionDate.toISOString()}`);

            // CRITICAL FIX: Only process if it's actually the coaching product
            if (actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID) {
              let ayoubQualifiesForFlatCommission = false;

              if (!session.discounts || session.discounts.length === 0) {
                // Condition: No discount was used at all for the coaching product sale
                ayoubQualifiesForFlatCommission = true;
                console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) had NO discount. Qualifies for $${AYOUB_FLAT_COMMISSION}.`);
              } else {
                // A discount was used. Check if it's one of the specifically allowed ones for Ayoub's flat commission.
                if (stripePromotionCodeId && AYOUB_ALLOWED_PROMO_IDS_FOR_FLAT_COMMISSION.includes(stripePromotionCodeId)) {
                  ayoubQualifiesForFlatCommission = true;
                  console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) used an ALLOWED promo ID ${stripePromotionCodeId}. Qualifies for $${AYOUB_FLAT_COMMISSION}.`);
                } else {
                  // A discount was used, but it's not one of the special ones for Ayoub's flat rate.
                  console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) used promo ID ${stripePromotionCodeId}, which is NOT in the allowed list for the flat $20 commission. Commission $0.`);
                }
              }

              if (ayoubQualifiesForFlatCommission) {
                affiliateCommission = AYOUB_FLAT_COMMISSION;
              } else {
                affiliateCommission = 0; // Explicitly $0 if conditions not met for the coaching product
              }
            } else {
              // It's Ayoub, but NOT the coaching product. Ayoub only gets commission on the coaching product.
              affiliateCommission = 0;
              console.log(`SyncStripe: AYOUB - Session ${session.id} - Product ${actualProductIdInSession} is not the coaching product (${AYOUB_COACHING_PRODUCT_ID}). No commission for Ayoub.`);
            }
          }
        } else if (affiliateCode) { // For other affiliates (Nic, Maru, etc.)
          console.log(`SyncStripe: Processing session ${session.id} for general affiliate: ${affiliateCode}.`);
          const { data: affiliateDetails, error: fetchRateError } = await supabaseClient
            .from('affiliates')
            .select('commission_rate')
            .eq('affiliate_code', affiliateCode)
            .single();

          if (fetchRateError || !affiliateDetails) {
            console.error(`SyncStripe: Could not fetch commission rate for affiliate ${affiliateCode} (Session: ${session.id}):`, fetchRateError?.message);
            affiliateCommission = 0; 
            console.warn(`SyncStripe: Assigning $0 commission for session ${session.id} due to missing rate for ${affiliateCode}.`);
          } else {
            const commissionRate = affiliateDetails.commission_rate;
            affiliateCommission = amountPaid * commissionRate;
            console.log(`SyncStripe: Calculated commission for ${affiliateCode} (Session: ${session.id}): AmountPaid $${amountPaid} * Rate ${commissionRate} = $${affiliateCommission.toFixed(2)}`);
          }
        }

        const record = {
          session_id: session.id,
          payment_intent_id: session.payment_intent || null,
          customer_email: session.customer_details?.email || null,
          amount_paid: amountPaid,
          affiliate_commission: parseFloat(affiliateCommission.toFixed(2)),
          promo_code_name: affiliateCode, // Store internal affiliate code
          promo_code_id: stripePromotionCodeId || "no_discount", // Store Stripe promotion code ID or special marker
          product_id: actualProductIdInSession,
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
