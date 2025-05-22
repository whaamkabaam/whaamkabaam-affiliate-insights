
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface User {
  email: string;
  password: string;
  affiliate_code?: string;
  is_admin: boolean;
}

// Handle CORS preflight request
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
}

// Create a single user and related records
async function createUser(
  supabase: any,
  serviceSuabase: any,
  { email, password, affiliate_code, is_admin }: User
) {
  try {
    console.log(`Processing user: ${email}`);
    
    // Check if user already exists (by email)
    const { data: existingUsers, error: checkError } = await serviceSuabase.auth.admin.listUsers();
    
    if (checkError) {
      console.error(`Error checking existing users:`, checkError);
      return { success: false, error: checkError };
    }
    
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    
    // If user exists, update their password
    if (existingUser) {
      console.log(`User ${email} already exists. Updating password.`);
      
      // Update the user's password
      const { data: updatedUser, error: updateError } = await serviceSuabase.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );
      
      if (updateError) {
        console.error(`Error updating password for ${email}:`, updateError);
        return { success: false, error: updateError };
      }
      
      console.log(`Updated password for user ${email}`);
      return { 
        success: true,
        exists: true,
        email,
        password,
        userId: existingUser.id
      };
    }

    // Create user in auth system with explicit data
    const { data: authData, error: authError } = await serviceSuabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        is_admin: is_admin,
        affiliate_code: affiliate_code || null
      }
    });

    if (authError) {
      console.error(`Error creating user ${email}:`, authError);
      return { success: false, error: authError };
    }

    const userId = authData.user.id;
    console.log(`Created user ${email} with ID ${userId}`);

    // Create profile entry
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: email.split('@')[0].toUpperCase(),
        display_name: email.split('@')[0]
      });

    if (profileError) {
      console.error(`Error creating profile for ${email}:`, profileError);
      // Continue anyway, profile is not critical
    }

    // If admin, add admin role through the affiliate table with high commission rate
    if (is_admin) {
      const { error: adminError } = await supabase
        .from('affiliates')
        .insert({
          user_id: userId,
          affiliate_code: 'admin',
          commission_rate: 0.5, // 50% commission indicates admin role
        });

      if (adminError) {
        console.error(`Error setting admin role for ${email}:`, adminError);
        return { success: false, error: adminError };
      }
    } else {
      // If not admin, it's a regular affiliate
      if (affiliate_code) {
        const { error: affiliateError } = await supabase
          .from('affiliates')
          .insert({
            user_id: userId,
            affiliate_code,
            commission_rate: 0.1, // 10% commission for regular affiliates
          });

        if (affiliateError) {
          console.error(`Error creating affiliate for ${email}:`, affiliateError);
          return { success: false, error: affiliateError };
        }
      }
    }

    return { 
      success: true, 
      email,
      password,
      userId,
      affiliate_code, 
      is_admin
    };
  } catch (error) {
    console.error(`Unexpected error setting up user ${email}:`, error);
    return { success: false, error };
  }
}

Deno.serve(async (req) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Get environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return new Response(
      JSON.stringify({ 
        error: 'Missing Supabase environment variables',
        envVars: {
          url: !!supabaseUrl,
          anonKey: !!supabaseAnonKey,
          serviceKey: !!supabaseServiceKey
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`Creating Supabase clients with URL: ${supabaseUrl}`);

  // Create Supabase clients
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const serviceSuabase = createClient(supabaseUrl, supabaseServiceKey);

  // Define passwords for all users - simpler passwords for testing
  // Use simpler passwords for testing to avoid special character issues
  const ayoubPassword = "AyoubTest123";
  const nicPassword = "NicTest123";
  const maruPassword = "MaruTest123";
  const adminPassword = "AdminTest123";

  // Log what we're about to do
  console.log("Generated test passwords:");
  console.log(`Admin: ${adminPassword}`);
  console.log(`Ayoub: ${ayoubPassword}`);
  console.log(`Nic: ${nicPassword}`);
  console.log(`Maru: ${maruPassword}`);

  // Create all users
  const users: User[] = [
    { email: 'ayoub@whaamkabaam.com', password: ayoubPassword, affiliate_code: 'ayoub', is_admin: false },
    { email: 'nic@whaamkabaam.com', password: nicPassword, affiliate_code: 'nic', is_admin: false },
    { email: 'maru@whaamkabaam.com', password: maruPassword, affiliate_code: 'maru', is_admin: false },
    { email: 'admin@whaamkabaam.com', password: adminPassword, is_admin: true },
  ];

  console.log(`Starting to create ${users.length} users`);
  
  const results = [];
  for (const user of users) {
    console.log(`Processing user: ${user.email}`);
    const result = await createUser(supabase, serviceSuabase, user);
    results.push({
      email: user.email,
      success: result.success,
      password: result.success ? user.password : undefined,
      exists: result.exists || false,
      error: result.success ? undefined : result.error,
    });
  }

  console.log(`Creation process completed with results:`, results);

  return new Response(
    JSON.stringify({
      message: 'User setup process completed',
      results,
      supabaseUrl, // Include this for debugging
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
})
