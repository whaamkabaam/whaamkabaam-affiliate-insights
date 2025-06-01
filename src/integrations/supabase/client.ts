
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://xfkkmkxeoqawqnvahhoe.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhma2tta3hlb3Fhd3FudmFoaG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NTIxNjAsImV4cCI6MjA2MzUyODE2MH0.FEM3uhXSTXgx7Ro3vbG9q8PLqPohDsg8IX8ELH6Rm70"

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
