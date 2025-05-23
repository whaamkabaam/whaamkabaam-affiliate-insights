
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // For security, verify that the user is authenticated
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    // Get the admin role to check permissions
    const { data: roleData, error: roleError } = await supabaseClient.rpc('get_user_role', {
      user_id: user.id
    });
    
    if (roleError || roleData !== 'admin') {
      console.log("Role check error:", roleError);
      console.log("Role data:", roleData);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }
    
    // Parse the request body to get the key
    const { key } = await req.json();
    
    if (!key || typeof key !== 'string' || !key.startsWith('sk_')) {
      return new Response(
        JSON.stringify({ error: "Invalid API key format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Store the key in Supabase secrets
    const { error: secretError } = await supabaseClient
      .rpc('admin_set_secret', {
        secret_name: 'stripe_secret_key',
        secret_value: key
      });
      
    if (secretError) {
      console.error("Error storing secret:", secretError);
      return new Response(
        JSON.stringify({ error: "Failed to store API key: " + secretError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Return success
    return new Response(
      JSON.stringify({ message: "API key saved successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (error) {
    console.error("Error setting Stripe key:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
