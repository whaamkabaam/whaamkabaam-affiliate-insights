
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

interface AffiliateCommission {
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
  // Handle CORS preflight requests FIRST
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
    let options = {
      fullRefresh: false,
      progressCallback: false
    };
    
    try {
      options = await req.json();
      console.log("Request options:", options);
    } catch (error) {
      console.log("Failed to parse request body, using default options");
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

    // Function to process a Stripe checkout session and return commission data only
    async function processCheckoutSession(session: any): Promise<AffiliateCommission | null> {
      try {
        // Only process paid sessions
        if (session.payment_status !== 'paid') {
          return null;
        }
        
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
          
          const discount = session.total_details.breakdown.discounts[0];
          if (discount.discount) {
            promoCodeId = discount.discount.promotion_code || discount.discount.id;
            
            if (discount.discount.promotion_code) {
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
        
        // Only return commission data if there's an affiliate involved
        if (!affiliateCode || affiliateRate <= 0) {
          return null;
        }
        
        // Calculate affiliate commission
        const affiliateCommission = (session.amount_total / 100) * affiliateRate;
        
        // Create the commission record
        const commissionRecord: AffiliateCommission = {
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
        
        return commissionRecord;
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
    
    // Function to update progress
    async function updateProgress(progress: number): Promise<void> {
      try {
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: { progress: progress },
          })
          .eq('key', 'stripe_sync_progress');
        
        if (error) {
          console.error('Error updating progress:', error);
        }
      } catch (err) {
        console.error('Error in updateProgress:', err);
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
    let totalEstimated = 0;
    
    try {
      // First, get an estimate of the total number of sessions to process
      const countResult = await stripe.checkout.sessions.list({
        limit: 1,
        created: { gt: createdAfter },
      });
      
      // Roughly estimate total based on has_more flag
      totalEstimated = countResult.has_more ? 100 : countResult.data.length;
      
      // Create a paginated query with auto-pagination
      let hasMore = true;
      let startingAfter = null;
      
      while (hasMore) {
        // Update bookmark before processing any data
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
        
        // Adjust our estimate now that we have more data
        if (totalEstimated < sessions.data.length) {
          totalEstimated = sessions.data.length;
        }
        if (sessions.has_more && totalEstimated < 500) {
          totalEstimated *= 2;
        }
        
        console.log(`Retrieved ${sessions.data.length} sessions, estimated total: ${totalEstimated}`);
        
        // Collect commission records for batch processing
        const commissionBatch: AffiliateCommission[] = [];
        
        // Process each session
        for (const session of sessions.data) {
          processed++;
          
          try {
            // Process the session with expanded data
            const commissionRecord = await processCheckoutSession(session);
            
            if (commissionRecord) {
              // Add to batch instead of individual upsert
              commissionBatch.push(commissionRecord);
              saved++;
            } else {
              skipped++;
            }
            
            // Update progress every 10 sessions
            if (processed % 10 === 0) {
              const progressPercent = Math.min(Math.round((processed / totalEstimated) * 100), 99);
              await updateProgress(progressPercent);
            }
          } catch (error) {
            console.error(`Error processing session ${session.id}: ${error}`);
            errors++;
          }
        }
        
        // Batch upsert only commission records
        if (commissionBatch.length > 0) {
          const { error } = await supabase
            .from('promo_code_sales')
            .upsert(commissionBatch, { 
              onConflict: 'session_id',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`Error batch upserting ${commissionBatch.length} commission records: ${error.message}`);
            errors += commissionBatch.length;
            // Adjust the saved count to account for failed saves
            saved -= commissionBatch.length;
          }
        }
        
        // Update pagination for next batch
        if (sessions.has_more && sessions.data.length > 0) {
          startingAfter = sessions.data[sessions.data.length - 1].id;
          
          // Store this as our latest checkpoint
          const checkpointSession = sessions.data[sessions.data.length - 1];
          if (checkpointSession?.created) {
            await supabase
              .from('system_settings')
              .update({ 
                value: { 
                  timestamp: new Date(checkpointSession.created * 1000).toISOString(),
                  last_id: checkpointSession.id,
                  processed: processed,
                  saved: saved,
                  progress: Math.min(Math.round((processed / totalEstimated) * 100), 99)
                }
              })
              .eq('key', 'stripe_sync_progress');
          }
          
          console.log(`More sessions available, continuing with cursor: ${startingAfter}`);
        } else {
          hasMore = false;
          console.log("No more sessions to fetch");
        }
      }
      
      // Update the last refresh timestamp one final time and mark sync as complete (100%)
      await updateLastRefreshTimestamp();
      await updateProgress(100);
      
      console.log(`Sync complete: processed ${processed}, saved ${saved} commission records, skipped ${skipped}, errors ${errors}`);
      
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
