
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.26.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Generate a secure random password
function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password to randomize the position of required characters
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user } = await req.json();

    // 1. Create Users with secure passwords
    async function setupUsers() {
      console.log("Setting up initial users with secure passwords...");
      
      const users = [
        { email: "ayoub@whaamkabaam.com", name: "Ayoub Test" },
        { email: "nic@whaamkabaam.com", name: "Nic Test" },
        { email: "maru@whaamkabaam.com", name: "Maru Test" },
        { email: "admin@whaamkabaam.com", name: "Admin User" }
      ];
      
      const createdUsers = [];
      
      for (const userData of users) {
        try {
          // Check if user already exists using admin API
          const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (listError) {
            console.error(`Error listing users: ${listError.message}`);
            continue;
          }
          
          const existingUser = existingUsers.users.find(u => u.email === userData.email);
          
          if (existingUser) {
            console.log(`User ${userData.email} already exists, skipping creation.`);
            continue;
          }
          
          // Generate secure password
          const securePassword = generateSecurePassword(20);
          
          // Create user using admin API
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: securePassword,
            user_metadata: {
              name: userData.name
            },
            email_confirm: true
          });
          
          if (error) {
            console.error(`Error creating user ${userData.email}: ${error.message}`);
          } else {
            console.log(`User ${userData.email} created with ID: ${data.user?.id}`);
            
            // Store the generated password info for the response
            createdUsers.push({
              email: userData.email,
              password: securePassword,
              name: userData.name
            });
            
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
      
      return createdUsers;
    }

    // After creating users, ensure they have affiliate entries
    async function setupAffiliates() {
      console.log("Setting up affiliate entries for users...");
      
      const affiliateSetups = [
        { email: "ayoub@whaamkabaam.com", code: "ayoub", rate: 0.1, stripePromoId: "promo_ayoub" },
        { email: "nic@whaamkabaam.com", code: "nic", rate: 0.1, stripePromoId: "promo_1QyefCCgyJ2z2jNZEZv16p7s" },
        { email: "maru@whaamkabaam.com", code: "maru", rate: 0.1, stripePromoId: "promo_1QvpMsCgyJ2z2jNZ0IC6vKLk" },
        { email: "admin@whaamkabaam.com", code: "ADMIN", rate: 0.2, stripePromoId: "promo_admin" }
      ];
      
      for (const setup of affiliateSetups) {
        try {
          // Get user ID by listing users and finding by email
          const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (listError) {
            console.error(`Error listing users: ${listError.message}`);
            continue;
          }
          
          const userData = allUsers.users.find(u => u.email === setup.email);
          
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
          
          const affiliatePayload = {
            user_id: userData.id,
            affiliate_code: setup.code,
            commission_rate: setup.rate,
            stripe_promotion_code_id: setup.stripePromoId
          };
          
          if (existingAffiliates && existingAffiliates.length > 0) {
            console.log(`Affiliate entry already exists for ${setup.email}, updating...`);
            
            // Update existing entry
            const { error: updateError } = await supabaseAdmin
              .from('affiliates')
              .update(affiliatePayload)
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
              .insert(affiliatePayload);
              
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

    const createdUsers = await setupUsers();
    await setupAffiliates();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Initial users and affiliates setup completed with secure passwords.',
        users: createdUsers.map(user => ({
          email: user.email,
          name: user.name,
          password: user.password
        }))
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
