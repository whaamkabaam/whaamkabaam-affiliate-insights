
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0'
import { Stripe } from 'https://esm.sh/stripe@14.22.0'
import { corsHeaders } from '../_shared/cors.ts'

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize Stripe
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
})

interface SystemSettings {
  timestamp: string;
}

interface PromoCodeSale {
  session_id: string;
  payment_intent_id: string | null;
  customer_email: string | null;
  amount_paid: number;
  product_id: string | null;
  product_name: string | null;
  promo_code_id: string | null;
  promo_code_name: string | null;
  affiliate_commission: number | null;
  created_at: string;
  refreshed_at: string;
}

// Main handler
serve(async (req: Request) => {
  // IMPORTANT: Handle CORS preflight requests FIRST - before any other processing
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  try {
    console.log("Function started, method:", req.method);
    
    // Check for valid method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Check authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Parse request body for options
    let options = {};
    try {
      options = await req.json();
      console.log("Request options:", options);
    } catch (error) {
      console.log("Failed to parse request body, using default options");
      // If body parsing fails, default options are fine
    }
    
    // Function to map promo code to affiliate code
    async function getAffiliateCodeByPromoCode(promoCode: string): Promise<{ code: string; rate: number } | null> {
      console.log(`Looking up affiliate for promo code: ${promoCode}`);
      
      // First check if the promo code directly matches an affiliate code
      const { data: affiliates, error } = await supabase
        .from('affiliates')
        .select('affiliate_code, commission_rate')
        .ilike('affiliate_code', promoCode);
      
      if (error) {
        console.error(`Error looking up affiliate: ${error.message}`);
        return null;
      }
      
      if (affiliates && affiliates.length > 0) {
        console.log(`Found matching affiliate: ${affiliates[0].affiliate_code}`);
        return { 
          code: affiliates[0].affiliate_code,
          rate: affiliates[0].commission_rate 
        };
      }
      
      // Add special mapping for "nic" and "maru" if they aren't direct matches
      const specialMappings: Record<string, { code: string, rate: number }> = {
        'nic': { code: 'nic', rate: 0.1 },
        'maru': { code: 'maru', rate: 0.1 },
      };
      
      const normalizedPromoCode = promoCode.toLowerCase();
      if (normalizedPromoCode in specialMappings) {
        console.log(`Using special mapping for ${normalizedPromoCode}`);
        return specialMappings[normalizedPromoCode];
      }
      
      console.log(`No affiliate found for promo code: ${promoCode}`);
      return null;
    }

    // Function to process a Stripe checkout session
    async function processCheckoutSession(session: any): Promise<PromoCodeSale | null> {
      try {
        // Only process paid sessions
        if (session.payment_status !== 'paid') {
          return null;
        }
        
        // No need to make separate API calls - use the expanded data
        let productId = null;
        let productName = null;
        
        // Get line items from the expanded session data
        const lineItem = session.line_items?.data?.[0];
        if (lineItem?.price?.product) {
          const product = lineItem.price.product;
          productId = typeof product === 'string' ? product : product.id;
          productName = typeof product === 'string' ? null : product.name;
        }
        
        // Get promo code information
        let promoCodeId = null;
        let promoCodeName = null;
        let affiliateCode = null;
        let affiliateRate = 0;
        
        // Check if there are any discounts and process them
        if (session.total_details?.breakdown?.discounts && 
            session.total_details.breakdown.discounts.length > 0) {
          
          // Get the promotion code from expanded data
          const discount = session.total_details.breakdown.discounts[0];
          if (discount.discount) {
            promoCodeId = discount.discount.promotion_code || discount.discount.id;
            
            if (discount.discount.promotion_code) {
              // Get promo code from expanded data if available
              promoCodeName = discount.discount.code;
            }
            
            // If we have a promo code name, map it to an affiliate
            if (promoCodeName) {
              const affiliateInfo = await getAffiliateCodeByPromoCode(promoCodeName);
              if (affiliateInfo) {
                affiliateCode = affiliateInfo.code;
                affiliateRate = affiliateInfo.rate;
              }
            }
          }
        }
        
        // Calculate affiliate commission (if applicable)
        let affiliateCommission = null;
        if (affiliateCode && affiliateRate > 0) {
          // Divide by 100 because Stripe amount is in cents
          affiliateCommission = (session.amount_total / 100) * affiliateRate;
        }
        
        // Create the record
        const saleRecord: PromoCodeSale = {
          session_id: session.id,
          payment_intent_id: session.payment_intent || null,
          customer_email: session.customer_details?.email || null,
          amount_paid: session.amount_total / 100, // Convert from cents
          product_id: productId,
          product_name: productName,
          promo_code_id: promoCodeId,
          promo_code_name: affiliateCode, // Use the mapped affiliate code
          affiliate_commission: affiliateCommission,
          created_at: new Date(session.created * 1000).toISOString(),
          refreshed_at: new Date().toISOString()
        };
        
        return saleRecord;
      } catch (error) {
        console.error(`Error processing session ${session.id}: ${error}`);
        return null;
      }
    }
    
    // Function to get the last refresh timestamp
    async function getLastRefreshTimestamp(): Promise<string> {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'last_stripe_refresh')
        .single();
      
      if (error || !data) {
        console.error('Error fetching last refresh timestamp:', error);
        // Default to 30 days ago if no timestamp found
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return thirtyDaysAgo.toISOString();
      }
      
      return (data.value as SystemSettings).timestamp;
    }
    
    // Function to update the last refresh timestamp
    async function updateLastRefreshTimestamp(): Promise<void> {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: { timestamp: now },
          updated_at: now
        })
        .eq('key', 'last_stripe_refresh');
      
      if (error) {
        console.error('Error updating last refresh timestamp:', error);
      }
    }
    
    // Determine the created_at filter based on full_refresh option or last timestamp
    const fullRefresh = options?.fullRefresh === true;
    let createdAfter: number;
    
    if (fullRefresh) {
      // If full refresh, start from beginning of time
      createdAfter = 0;
      console.log("Full refresh requested, fetching all sessions");
    } else {
      // Get the last refresh timestamp
      const lastRefreshIso = await getLastRefreshTimestamp();
      createdAfter = Math.floor(new Date(lastRefreshIso).getTime() / 1000);
      console.log(`Incremental refresh, fetching sessions after ${new Date(createdAfter * 1000).toISOString()}`);
    }
    
    // Initialize counters
    let processed = 0;
    let saved = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
      // Create a paginated query with auto-pagination
      let hasMore = true;
      let startingAfter = null;
      
      while (hasMore) {
        // Update timestamp at the beginning of each page to bookmark progress
        // This ensures that even if the function times out, we won't start from the beginning
        await updateLastRefreshTimestamp();
        
        const queryParams: any = {
          limit: 100,
          created: { gt: createdAfter },
          // Expand the data we need to avoid additional API calls
          expand: [
            'data.line_items',
            'data.line_items.data.price.product',
            'data.total_details.breakdown.discounts.discount',
            'data.customer_details'
          ]
        };
        
        if (startingAfter) {
          queryParams.starting_after = startingAfter;
        }
        
        console.log(`Fetching batch of sessions, params:`, queryParams);
        
        // Fetch sessions from Stripe with expanded data
        const sessions = await stripe.checkout.sessions.list(queryParams);
        console.log(`Retrieved ${sessions.data.length} sessions`);
        
        // Collect records for batch processing
        const batch: PromoCodeSale[] = [];
        
        // Process each session
        for (const session of sessions.data) {
          processed++;
          
          try {
            // Process the session with expanded data
            const saleRecord = await processCheckoutSession(session);
            
            if (saleRecord) {
              // Add to batch instead of individual upsert
              batch.push(saleRecord);
              saved++;
            } else {
              skipped++;
            }
          } catch (error) {
            console.error(`Error processing session ${session.id}: ${error}`);
            errors++;
          }
        }
        
        // Batch upsert all processed records
        if (batch.length > 0) {
          const { error } = await supabase
            .from('promo_code_sales')
            .upsert(batch, { 
              onConflict: 'session_id',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`Error batch upserting ${batch.length} records: ${error.message}`);
            errors += batch.length;
            // Adjust the saved count to account for failed saves
            saved -= batch.length;
          }
        }
        
        // Update pagination for next batch
        if (sessions.has_more && sessions.data.length > 0) {
          startingAfter = sessions.data[sessions.data.length - 1].id;
          console.log(`More sessions available, continuing with cursor: ${startingAfter}`);
        } else {
          hasMore = false;
          console.log("No more sessions to fetch");
        }
      }
      
      // Update the last refresh timestamp one final time
      await updateLastRefreshTimestamp();
      console.log(`Sync complete: processed ${processed}, saved ${saved}, skipped ${skipped}, errors ${errors}`);
      
      // Return summary with CORS headers
      return new Response(JSON.stringify({
        success: true,
        stats: {
          processed,
          saved,
          skipped,
          errors
        }
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (stripeError) {
      console.error('Error in Stripe API calls:', stripeError);
      return new Response(JSON.stringify({ error: stripeError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error in sync-stripe-data:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
