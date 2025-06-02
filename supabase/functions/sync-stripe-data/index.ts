
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
  const AYOUB_COACHING_PRODUCT_ID = "prod_RINO6yE0y4O9gX";
  const AYOUB_FLAT_COMMISSION = 20;
  const AYOUB_ALLOWED_PROMO_IDS_FOR_FLAT_COMMISSION = [
    "promo_1QccV9CgyJ2z2jNZBnSTn73U",
    "promo_1QccV9CgyJ2z2jNZpn1g55Dm",
    "promo_1QccV9CgyJ2z2jNZ5NxQQDGO",
    "promo_1QccV9CgyJ2z2jNZMLVi7Lv7"
  ];
  const AYOUB_START_DATE = new Date("2025-05-20T00:00:00Z");
  const OTHER_AFFILIATES_START_DATE = new Date("2025-03-01T00:00:00Z");

  try {
    const requestData = await req.json();
    const { year, month, forceRefresh = false, affiliateCode = null } = requestData;

    console.log(`Syncing Stripe data for ${year}-${month}, forceRefresh: ${forceRefresh}, affiliateCode: ${affiliateCode}`);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ENHANCED: Calculate Unix timestamps with affiliate-specific minimum dates
    let startTimestamp, endTimestamp;
    let startDate, endDate;
    
    if (year === 0 && month === 0) {
      // For "All Time" - use affiliate-specific start dates
      if (affiliateCode === AYOUB_AFFILIATE_CODE) {
        startDate = AYOUB_START_DATE;
        console.log(`Using Ayoub-specific start date: ${startDate.toISOString()}`);
      } else if (affiliateCode && affiliateCode !== 'admin') {
        startDate = OTHER_AFFILIATES_START_DATE;
        console.log(`Using other affiliate start date for ${affiliateCode}: ${startDate.toISOString()}`);
      } else {
        // For admin or unspecified - use broader range
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        startDate = fiveYearsAgo;
        console.log(`Using admin/default start date: ${startDate.toISOString()}`);
      }
      endDate = new Date(); // Current time for latest data
      startTimestamp = Math.floor(startDate.getTime() / 1000);
      endTimestamp = Math.floor(endDate.getTime() / 1000);
      console.log(`Fetching Stripe sessions for "All Time" from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // For specific month/year - ensure we capture the ENTIRE month but respect affiliate minimums
      const requestedStartDate = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0);
      
      // Apply affiliate-specific minimum dates
      if (affiliateCode === AYOUB_AFFILIATE_CODE) {
        startDate = new Date(Math.max(requestedStartDate.getTime(), AYOUB_START_DATE.getTime()));
        console.log(`Ayoub-specific: Using start date ${startDate.toISOString()} (max of requested ${requestedStartDate.toISOString()} and Ayoub minimum ${AYOUB_START_DATE.toISOString()})`);
      } else if (affiliateCode && affiliateCode !== 'admin') {
        startDate = new Date(Math.max(requestedStartDate.getTime(), OTHER_AFFILIATES_START_DATE.getTime()));
        console.log(`Other affiliate: Using start date ${startDate.toISOString()} (max of requested ${requestedStartDate.toISOString()} and affiliate minimum ${OTHER_AFFILIATES_START_DATE.toISOString()})`);
      } else {
        startDate = requestedStartDate;
        console.log(`Admin/default: Using requested start date ${startDate.toISOString()}`);
      }
      
      // CRITICAL FIX: For current month, use current time as end date to get latest data
      const currentDate = new Date();
      const isCurrentMonth = year == currentDate.getFullYear() && month == (currentDate.getMonth() + 1);
      
      if (isCurrentMonth) {
        endDate = new Date(); // Use current time for current month
        console.log(`CURRENT MONTH SYNC: Using current time as end date: ${endDate.toISOString()}`);
      } else {
        endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999); // Last day of month
      }
      
      startTimestamp = Math.floor(startDate.getTime() / 1000);
      endTimestamp = Math.floor(endDate.getTime() / 1000);
      console.log(`Fetching Stripe sessions from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    console.log(`Unix timestamps: ${startTimestamp} to ${endTimestamp}`);

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
        const customerEmail = session.customer_details?.email || 'unknown';
        
        console.log(`Processing session ${session.id}: Product ${actualProductIdInSession}, Date: ${sessionDate.toISOString()}, Customer: ${customerEmail}`);
        
        // CRITICAL: Only process sessions that are actually paid
        if (session.payment_status !== "paid") {
          console.log(`Skipping session ${session.id} for customer ${customerEmail} due to payment_status: ${session.payment_status}`);
          continue;
        }
        
        // Extract promotion code and affiliate assignment
        let stripePromotionCodeId = null;
        let sessionAffiliateCode = null;
        
        if (session.discounts && session.discounts.length > 0) {
          for (const discount of session.discounts) {
            if (discount.promotion_code) {
              stripePromotionCodeId = discount.promotion_code;
              break;
            } else if (discount.coupon && discount.coupon.id) {
              stripePromotionCodeId = discount.coupon.id;
              break;
            } else if (discount.id) {
              stripePromotionCodeId = discount.id;
              break;
            }
          }
        }

        console.log(`Found stripePromotionCodeId: ${stripePromotionCodeId}`);

        // CRITICAL AYOUB LOGIC: Only assign Ayoub to coaching products after his start date
        if (!stripePromotionCodeId && 
            actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID && 
            sessionDate >= AYOUB_START_DATE) {
          console.log(`AYOUB SPECIAL CASE: Found coaching product sale without discount code on ${sessionDate.toISOString()}, assigning to Ayoub`);
          sessionAffiliateCode = AYOUB_AFFILIATE_CODE;
          stripePromotionCodeId = "no_discount_ayoub_coaching";
        } else if (stripePromotionCodeId) {
          // Map Stripe promotion code to internal affiliate code
          sessionAffiliateCode = stripeToAffiliateMap[stripePromotionCodeId];
          console.log(`Mapped ${stripePromotionCodeId} to affiliateCode: ${sessionAffiliateCode}`);
        }
        
        // ENHANCED: If we're syncing for a specific affiliate, only process their sessions
        if (affiliateCode && affiliateCode !== 'admin' && sessionAffiliateCode !== affiliateCode) {
          console.log(`Skipping session ${session.id} - belongs to ${sessionAffiliateCode}, but syncing for ${affiliateCode}`);
          continue;
        }
        
        // Skip sessions without affiliate assignment
        if (!sessionAffiliateCode) {
          console.log(`No affiliate assignment for session ${session.id}, skipping`);
          continue;
        }

        // DOUBLE CRITICAL CHECK: For Ayoub, absolutely ensure it's the coaching product
        if (sessionAffiliateCode === AYOUB_AFFILIATE_CODE && actualProductIdInSession !== AYOUB_COACHING_PRODUCT_ID) {
          console.log(`CRITICAL BLOCK: Ayoub assigned to non-coaching product ${actualProductIdInSession}, skipping session ${session.id}`);
          continue;
        }

        console.log(`Found affiliate session: ${session.id} -> ${sessionAffiliateCode} (${stripePromotionCodeId || 'no discount'}) for product ${actualProductIdInSession}`);

        // FIXED: Commission calculation logic - 20% for non-Ayoub, special logic for Ayoub
        const amountPaid = (session.amount_total || 0) / 100;
        const originalAmount = (session.amount_subtotal || session.amount_total || 0) / 100; // Use subtotal (pre-discount) for commission calculation
        let affiliateCommission = 0;

        if (sessionAffiliateCode === AYOUB_AFFILIATE_CODE) {
          if (sessionDate < AYOUB_START_DATE) {
            console.log(`SyncStripe: Ayoub session ${session.id} is before start date ${AYOUB_START_DATE.toISOString()}, skipping commission.`);
            affiliateCommission = 0;
          } else {
            console.log(`SyncStripe: Processing session ${session.id} for AYOUB. Product: ${actualProductIdInSession}. Promo code on session: ${stripePromotionCodeId || 'none'}. Date: ${sessionDate.toISOString()}`);

            if (actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID) {
              let ayoubQualifiesForFlatCommission = false;

              if (!session.discounts || session.discounts.length === 0) {
                ayoubQualifiesForFlatCommission = true;
                console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) had NO discount. Qualifies for $${AYOUB_FLAT_COMMISSION}.`);
              } else {
                if (stripePromotionCodeId && AYOUB_ALLOWED_PROMO_IDS_FOR_FLAT_COMMISSION.includes(stripePromotionCodeId)) {
                  ayoubQualifiesForFlatCommission = true;
                  console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) used an ALLOWED promo ID ${stripePromotionCodeId}. Qualifies for $${AYOUB_FLAT_COMMISSION}.`);
                } else {
                  console.log(`SyncStripe: AYOUB - Session ${session.id} (Product: ${AYOUB_COACHING_PRODUCT_ID}) used promo ID ${stripePromotionCodeId}, which is NOT in the allowed list for the flat $20 commission. Commission $0.`);
                }
              }

              if (ayoubQualifiesForFlatCommission) {
                affiliateCommission = AYOUB_FLAT_COMMISSION;
                console.log(`SyncStripe: AYOUB - Final commission for session ${session.id}: $${AYOUB_FLAT_COMMISSION}`);
              } else {
                affiliateCommission = 0;
              }
            } else {
              affiliateCommission = 0;
              console.log(`SyncStripe: AYOUB - Session ${session.id} - Product ${actualProductIdInSession} is not the coaching product (${AYOUB_COACHING_PRODUCT_ID}). No commission for Ayoub.`);
            }
          }
        } else if (sessionAffiliateCode) {
          // FIXED: For other affiliates - calculate commission on ORIGINAL price (pre-discount) at 20%
          console.log(`SyncStripe: Processing session ${session.id} for general affiliate: ${sessionAffiliateCode}.`);
          
          const commissionRate = 0.2; // 20% commission rate for all non-Ayoub affiliates
          affiliateCommission = originalAmount * commissionRate;
          console.log(`SyncStripe: Commission calculation for ${sessionAffiliateCode} (Session: ${session.id}): OriginalAmount $${originalAmount} * Rate ${commissionRate} (20%) = $${affiliateCommission.toFixed(2)}`);
        }

        const record = {
          session_id: session.id,
          payment_intent_id: session.payment_intent || null,
          customer_email: session.customer_details?.email || null,
          amount_paid: amountPaid,
          affiliate_commission: parseFloat(affiliateCommission.toFixed(2)),
          promo_code_name: sessionAffiliateCode,
          promo_code_id: stripePromotionCodeId || "no_discount",
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

    // Before saving new records, delete existing records for this period to ensure clean data
    console.log(`Deleting existing records for ${year}-${month} to ensure clean data...`);
    const { error: deleteError } = await supabaseClient
      .from('promo_code_sales')
      .delete()
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (deleteError) {
      console.error('Error deleting existing records:', deleteError);
    } else {
      console.log('Successfully deleted existing records for clean sync');
    }

    // Save commission records to database using batch upserts
    if (commissionRecords.length > 0) {
      const batchSize = 50;
      let savedCount = 0;

      for (let i = 0; i < commissionRecords.length; i += batchSize) {
        const batch = commissionRecords.slice(i, i + batchSize);
        
        console.log(`Saving batch ${Math.ceil((i + 1) / batchSize)}: ${batch.length} records`);
        
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
