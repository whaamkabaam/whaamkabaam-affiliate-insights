
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

// Generate a random password with specified length
function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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
  // Create user in auth system
  const { data: authData, error: authError } = await serviceSuabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    console.error(`Error creating user ${email}:`, authError)
    return { success: false, error: authError }
  }

  const userId = authData.user.id

  try {
    // If admin, add admin role
    if (is_admin) {
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'admin',
      })
    } else {
      // If not admin, it's an affiliate
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'affiliate',
      })
      
      // Add affiliate record
      if (affiliate_code) {
        await supabase.from('affiliates').insert({
          id: userId,
          affiliate_code,
        })
      }
    }

    return { 
      success: true, 
      user: { 
        id: userId, 
        email, 
        password, 
        affiliate_code, 
        is_admin 
      } 
    }
  } catch (error) {
    console.error(`Error setting up user ${email}:`, error)
    return { success: false, error }
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Get environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create Supabase clients
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const serviceSuabase = createClient(supabaseUrl, supabaseServiceKey)

  // Define passwords for all users
  const ayoubPassword = generateRandomPassword()
  const nicPassword = generateRandomPassword()
  const maruPassword = generateRandomPassword()
  const adminPassword = generateRandomPassword()

  // Create all users
  const users: User[] = [
    { email: 'ayoub@whaamkabaam.com', password: ayoubPassword, affiliate_code: 'ayoub', is_admin: false },
    { email: 'nic@whaamkabaam.com', password: nicPassword, affiliate_code: 'nic', is_admin: false },
    { email: 'maru@whaamkabaam.com', password: maruPassword, affiliate_code: 'maru', is_admin: false },
    { email: 'admin@whaamkabaam.com', password: adminPassword, is_admin: true },
  ]

  const results = []
  for (const user of users) {
    const result = await createUser(supabase, serviceSuabase, user)
    results.push({
      email: user.email,
      success: result.success,
      password: result.success ? user.password : undefined,
      error: result.success ? undefined : result.error,
    })
  }

  return new Response(
    JSON.stringify({
      message: 'User setup process completed',
      results,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
