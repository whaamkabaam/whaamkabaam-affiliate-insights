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

  // List of problematic customer emails to track
  const PROBLEMATIC_EMAILS = ["nicholasm803@gmail.com", "novaapalz@gmail.com"];

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

    // FIXED: Calculate Unix timestamps for the date range with proper "All Time" handling
    let startTimestamp, endTimestamp;
    let startDate, endDate;
    
    if (year === 0 && month === 0) {
      // For "All Time" - fetch from a reasonable start date (e.g., 5 years ago) to now
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      startDate = fiveYearsAgo;
      endDate = new Date();
      startTimestamp = Math.floor(startDate.getTime() / 1000);
      endTimestamp = Math.floor(endDate.getTime() / 1000);
      console.log(`Fetching Stripe sessions for "All Time" (last 5 years) from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // CRITICAL FIX: For specific month/year - ensure we capture the ENTIRE month including the last day
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999); // Last day of month at 23:59:59
      startTimestamp = Math.floor(startDate.getTime() / 1000);
      endTimestamp = Math.floor(endDate.getTime() / 1000);
      console.log(`FIXED DATE RANGE: Fetching Stripe sessions from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    console.log(`Unix timestamps: ${startTimestamp} to ${endTimestamp}`);

    // CRITICAL: ALWAYS clean up incorrect Ayoub data first
    console.log("CRITICAL CLEANUP: Removing ALL incorrect Ayoub data from database...");
    const { error: cleanupError } = await supabaseClient
      .from('promo_code_sales')
      .delete()
      .eq('promo_code_name', 'ayoub')
      .neq('product_id', AYOUB_COACHING_PRODUCT_ID);
    
    if (cleanupError) {
      console.error("Error cleaning up incorrect Ayoub data:", cleanupError);
    } else {
      console.log("Successfully cleaned up ALL incorrect Ayoub data");
    }

    // FIXED: Only sync when explicitly requested or for current month, not always
    const currentDate = new Date();
    const isCurrentMonth = year == currentDate.getFullYear() && month == (currentDate.getMonth() + 1);
    const shouldSync = forceRefresh || isCurrentMonth;
    
    console.log(`Starting Stripe data sync. Force refresh: ${forceRefresh}, Current month: ${isCurrentMonth}, Will sync: ${shouldSync}`);

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
        
        // COMPREHENSIVE LOGGING FOR PROBLEMATIC SESSIONS
        const isProblematicSession = PROBLEMATIC_EMAILS.includes(customerEmail);
        
        if (isProblematicSession) {
          console.log(`🔍 DETAILED DEBUG for PROBLEMATIC session ${session.id}:`);
          console.log(`- Session ID: ${session.id}`);
          console.log(`- Customer Email: ${customerEmail}`);
          console.log(`- Session Created: ${sessionDate.toISOString()}`);
          console.log(`- Ayoub Start Date: ${AYOUB_START_DATE.toISOString()}`);
          console.log(`- Date Check (>= start): ${sessionDate >= AYOUB_START_DATE}`);
          console.log(`- Product ID from session: ${actualProductIdInSession}`);
          console.log(`- Expected coaching product: ${AYOUB_COACHING_PRODUCT_ID}`);
          console.log(`- Product match: ${actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID}`);
          console.log(`- Session status: ${session.payment_status}`);
          console.log(`- Amount total: ${session.amount_total}`);
          console.log(`- Full session object:`, JSON.stringify(session, null, 2));
          console.log(`- Discounts array:`, JSON.stringify(session.discounts, null, 2));
          console.log(`- Line items:`, JSON.stringify(session.line_items, null, 2));
        }

        // CRITICAL FIX: Only process sessions that are actually paid
        if (session.payment_status !== "paid") {
          console.log(`Skipping session ${session.id} for customer ${customerEmail} due to payment_status: ${session.payment_status} (Overall status: ${session.status})`);
          if (isProblematicSession) {
            console.log(`🔍 PROBLEMATIC - SKIPPED due to payment_status: ${session.payment_status}, session status: ${session.status}`);
          }
          continue;
        }
        
        // ENHANCED DISCOUNT PROCESSING FOR NIC'S SESSIONS
        let stripePromotionCodeId = null;
        let affiliateCode = null;
        
        if (session.discounts && session.discounts.length > 0) {
          for (const discount of session.discounts) {
            console.log(`🔍 NIC DEBUG - Processing discount for session ${session.id}:`, JSON.stringify(discount, null, 2));
            
            // ENHANCED: Try multiple ways to extract promotion code
            if (discount.promotion_code) {
              stripePromotionCodeId = discount.promotion_code;
              console.log(`🔍 NIC DEBUG - Found promotion_code: ${stripePromotionCodeId}`);
              break;
            } else if (discount.coupon && discount.coupon.id) {
              stripePromotionCodeId = discount.coupon.id;
              console.log(`🔍 NIC DEBUG - Found coupon.id: ${stripePromotionCodeId}`);
              break;
            } else if (discount.id) {
              // Sometimes the discount ID itself is the promotion code
              stripePromotionCodeId = discount.id;
              console.log(`🔍 NIC DEBUG - Using discount.id: ${stripePromotionCodeId}`);
              break;
            }
          }
        }

        console.log(`🔍 NIC DEBUG - Final stripePromotionCodeId: ${stripePromotionCodeId}`);
        console.log(`🔍 NIC DEBUG - Available affiliate mappings:`, Object.keys(stripeToAffiliateMap));

        // CRITICAL AYOUB LOGIC: Only assign Ayoub to coaching products after his start date
        if (!stripePromotionCodeId && 
            actualProductIdInSession === AYOUB_COACHING_PRODUCT_ID && 
            sessionDate >= AYOUB_START_DATE) {
          console.log(`AYOUB SPECIAL CASE: Found coaching product sale without discount code on ${sessionDate.toISOString()}, assigning to Ayoub`);
          affiliateCode = AYOUB_AFFILIATE_CODE;
          stripePromotionCodeId = "no_discount_ayoub_coaching";
        } else if (stripePromotionCodeId) {
          // Map Stripe promotion code to internal affiliate code
          affiliateCode = stripeToAffiliateMap[stripePromotionCodeId];
          console.log(`🔍 NIC DEBUG - Mapped ${stripePromotionCodeId} to affiliateCode: ${affiliateCode}`);
          
          // ADDITIONAL DEBUGGING FOR NIC'S SPECIFIC PROMO CODE
          if (stripePromotionCodeId === "promo_1QyefCCgyJ2z2jNZEZv16p7s") {
            console.log(`🚨 NIC'S PROMO CODE DETECTED! Session: ${session.id}, Mapped to: ${affiliateCode}`);
            console.log(`🚨 NIC MAPPING CHECK - Available mappings:`, stripeToAffiliateMap);
          }
        }

        console.log(`🔍 NIC DEBUG - Final affiliateCode assignment: ${affiliateCode}`);
        
        // Skip sessions without affiliate assignment
        if (!affiliateCode) {
          console.log(`No affiliate assignment for session ${session.id}, skipping`);
          continue;
        }

        // DOUBLE CRITICAL CHECK: For Ayoub, absolutely ensure it's the coaching product
        if (affiliateCode === AYOUB_AFFILIATE_CODE && actualProductIdInSession !== AYOUB_COACHING_PRODUCT_ID) {
          console.log(`CRITICAL BLOCK: Ayoub assigned to non-coaching product ${actualProductIdInSession}, skipping session ${session.id}`);
          continue;
        }

        console.log(`Found affiliate session: ${session.id} -> ${affiliateCode} (${stripePromotionCodeId || 'no discount'}) for product ${actualProductIdInSession}`);

        // CRITICAL FIX: Commission calculation logic - use original price for non-Ayoub affiliates
        const amountPaid = (session.amount_total || 0) / 100;
        const originalAmount = (session.amount_subtotal || session.amount_total || 0) / 100; // Use subtotal (pre-discount) for commission calculation
        let affiliateCommission = 0;

        if (affiliateCode === AYOUB_AFFILIATE_CODE) {
          // ... keep existing code (Ayoub commission calculation logic)
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
        } else if (affiliateCode) {
          // CRITICAL FIX: For other affiliates (Nic, Maru, etc.) - calculate commission on ORIGINAL price (pre-discount) at 20%
          console.log(`SyncStripe: Processing session ${session.id} for general affiliate: ${affiliateCode}.`);
          
          // FIXED: Use 20% (0.2) commission rate for all non-Ayoub affiliates
          const commissionRate = 0.2; // 20% commission rate
          affiliateCommission = originalAmount * commissionRate;
          console.log(`SyncStripe: FIXED COMMISSION CALCULATION for ${affiliateCode} (Session: ${session.id}): OriginalAmount $${originalAmount} * Rate ${commissionRate} (20%) = $${affiliateCommission.toFixed(2)} (was incorrectly using paid amount $${amountPaid})`);
          
          // SPECIAL LOGGING FOR NIC
          if (affiliateCode === 'nic') {
            console.log(`🚨 NIC COMMISSION CALCULATION: Session ${session.id}, Original Amount: $${originalAmount}, Paid Amount: $${amountPaid}, Rate: ${commissionRate}, Commission: $${affiliateCommission.toFixed(2)}`);
          }
        }

        const record = {
          session_id: session.id,
          payment_intent_id: session.payment_intent || null,
          customer_email: session.customer_details?.email || null,
          amount_paid: amountPaid,
          affiliate_commission: parseFloat(affiliateCommission.toFixed(2)),
          promo_code_name: affiliateCode,
          promo_code_id: stripePromotionCodeId || "no_discount",
          product_id: actualProductIdInSession,
          product_name: session.line_items?.data?.[0]?.description || null,
          created_at: new Date(session.created * 1000).toISOString(),
          refreshed_at: new Date().toISOString()
        };

        // SPECIAL LOGGING FOR NIC'S RECORDS
        if (affiliateCode === 'nic') {
          console.log(`🚨 NIC RECORD CREATED:`, JSON.stringify(record, null, 2));
        }

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
    
    // LOG NIC'S RECORDS SPECIFICALLY
    const nicRecords = commissionRecords.filter(r => r.promo_code_name === 'nic');
    console.log(`🚨 NIC RECORDS FOUND: ${nicRecords.length}`);
    if (nicRecords.length > 0) {
      console.log(`🚨 NIC RECORDS:`, JSON.stringify(nicRecords, null, 2));
    }

    // Before saving new records, delete ALL existing records for this period to ensure clean data
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
      
      // FINAL CHECK FOR NIC'S DATA
      const { data: nicCheck, error: nicCheckError } = await supabaseClient
        .from('promo_code_sales')
        .select('*')
        .eq('promo_code_name', 'nic')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (!nicCheckError && nicCheck) {
        console.log(`🚨 NIC DATA CHECK AFTER SAVE: Found ${nicCheck.length} records in database`);
        if (nicCheck.length > 0) {
          console.log(`🚨 NIC SAVED RECORDS:`, JSON.stringify(nicCheck, null, 2));
        }
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
