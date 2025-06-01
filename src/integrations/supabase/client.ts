
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://njbfgdmnxvgffnqhzavr.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYmZnZG1ueHZnZmZucWh6YXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzNzU3NzUsImV4cCI6MjA0Nzk1MTc3NX0.PKhIlrvKXrAYqK2xZYyOOULZ8ZwmkHLNFJKCKDNEDAE"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Type definitions for better type safety
export type AppRole = 'admin' | 'affiliate'

export interface AffiliateData {
  affiliate_code: string;
  commission_rate: number;
}
