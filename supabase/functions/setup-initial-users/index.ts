
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0';
import { createClient as createAdminClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0';
import { createClient as createAuthClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);
const adminAuthClient = createAuthClient(supabaseUrl, supabaseServiceKey, {
  global: {
    headers: { 'Content-Type': 'application/json' },
  },
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user } = await req.json();

    // 1. Create Users
    async function setupUsers() {
      console.log("Setting up initial users...");
      
      const users = [
        { email: "ayoub@whaamkabaam.com", password: "Test1234!", name: "Ayoub Test" },
        { email: "nic@whaamkabaam.com", password: "Test1234!", name: "Nic Test" },
        { email: "maru@whaamkabaam.com", password: "Test1234!", name: "Maru Test" },
        { email: "admin@whaamkabaam.com", password: "AdminTest123", name: "Admin User" }
      ];
      
      for (const userData of users) {
        try {
          // Check if user already exists
          const { data: existingUser } = await adminAuthClient.getUserByEmail(userData.email);
          
          if (existingUser && existingUser.user) {
            console.log(`User ${userData.email} already exists, skipping creation.`);
            continue;
          }
          
          // Create user
          const { data, error } = await adminAuthClient.createUser({
            email: userData.email,
            password: userData.password,
            user_metadata: {
              name: userData.name
            }
          });
          
          if (error) {
            console.error(`Error creating user ${userData.email}: ${error.message}`);
          } else {
            console.log(`User ${userData.email} created with ID: ${data.user?.id}`);
            
            // Create profile for the user
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: data.user?.id,
                email: userData.email,
                full_name: userData.name,
                display_name: userData.name.split(" ")[0] // Use first name as display name
              });
            
            if (profileError) {
              console.error(`Error creating profile for ${userData.email}: ${profileError.message}`);
            } else {
              console.log(`Profile created for ${userData.email}`);
            }
          }
        } catch (err) {
          console.error(`Error setting up user ${userData.email}:`, err);
        }
      }
    }

    // After creating users, ensure they have affiliate entries
    async function setupAffiliates() {
      console.log("Setting up affiliate entries for users...");
      
      const affiliateSetups = [
        { email: "ayoub@whaamkabaam.com", code: "ayoub", rate: 0.1 },
        { email: "nic@whaamkabaam.com", code: "nic", rate: 0.1 },  // Make sure "nic" is added
        { email: "maru@whaamkabaam.com", code: "maru", rate: 0.1 }, // Make sure "maru" is added
        { email: "admin@whaamkabaam.com", code: "ADMIN", rate: 0.2 }
      ];
      
      for (const setup of affiliateSetups) {
        try {
          // Get user ID
          const { data: userData, error: userError } = await adminAuthClient.getUserByEmail(setup.email);
          
          if (userError) {
            console.error(`Error getting user ID for ${setup.email}: ${userError.message}`);
            continue;
          }
          
          if (!userData?.id) {
            console.error(`User ID not found for ${setup.email}`);
            continue;
          }
          
          // Check if affiliate entry already exists
          const { data: existingAffiliates, error: checkError } = await supabaseAdmin
            .from('affiliates')
            .select('*')
            .eq('user_id', userData.id);
            
          if (checkError) {
            console.error(`Error checking for existing affiliate entry: ${checkError.message}`);
            continue;
          }
          
          if (existingAffiliates && existingAffiliates.length > 0) {
            console.log(`Affiliate entry already exists for ${setup.email}, updating...`);
            
            // Update existing entry
            const { error: updateError } = await supabaseAdmin
              .from('affiliates')
              .update({ 
                affiliate_code: setup.code, 
                commission_rate: setup.rate 
              })
              .eq('user_id', userData.id);
              
            if (updateError) {
              console.error(`Error updating affiliate entry: ${updateError.message}`);
            } else {
              console.log(`Updated affiliate entry for ${setup.email}`);
            }
          } else {
            console.log(`Creating new affiliate entry for ${setup.email}`);
            
            // Create new affiliate entry
            const { error: insertError } = await supabaseAdmin
              .from('affiliates')
              .insert({
                user_id: userData.id,
                affiliate_code: setup.code,
                commission_rate: setup.rate
              });
              
            if (insertError) {
              console.error(`Error creating affiliate entry: ${insertError.message}`);
            } else {
              console.log(`Created affiliate entry for ${setup.email}`);
            }
          }
        } catch (err) {
          console.error(`Error setting up affiliate for ${setup.email}:`, err);
        }
      }
    }

    await setupUsers();
    await setupAffiliates();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Initial users and affiliates setup completed.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in setup-initial-users:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
