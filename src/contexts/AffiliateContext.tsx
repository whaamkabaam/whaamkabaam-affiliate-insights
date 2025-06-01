
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AffiliateRpcResponse } from "@/types/supabase";
import { toast } from "sonner";

export interface Commission {
  sessionId: string;
  paymentIntent?: string;
  customerEmail: string;
  amount: number;
  commission: number;
  date: string;
  productId: string;
}

export interface CommissionSummary {
  totalRevenue: number;
  totalCommission: number;
  customerCount: number;
}

export interface AffiliateOverview {
  email: string;
  affiliateCode: string;
  commissionRate: number;
  totalCommission: number;
  totalSales: number;
  totalRevenue?: number; // For backward compatibility
  customerCount: number;
}

interface AffiliateContextType {
  commissions: Commission[];
  isLoading: boolean;
  error: string | null;
  summary: CommissionSummary;
  fetchCommissionData: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  // Admin overview
  affiliateOverviews: AffiliateOverview[];
  fetchAffiliateOverviews: () => Promise<void>;
  isAdmin: boolean;
}

const defaultSummary: CommissionSummary = {
  totalRevenue: 0,
  totalCommission: 0,
  customerCount: 0
};

// Helper function to filter out hardcoded example data
const filterCommissions = (commissions: Commission[]): Commission[] => {
  return commissions.filter(commission => 
    commission.customerEmail && 
    !commission.customerEmail.includes('unknown@example.com') &&
    !commission.customerEmail.includes('example.com') &&
    commission.customerEmail !== 'unknown@example.com'
  );
};

// Helper function to calculate summary from filtered commissions
const calculateSummary = (commissions: Commission[]): CommissionSummary => {
  const filteredCommissions = filterCommissions(commissions);
  
  return {
    totalRevenue: filteredCommissions.reduce((sum, commission) => sum + commission.amount, 0),
    totalCommission: filteredCommissions.reduce((sum, commission) => sum + commission.commission, 0),
    customerCount: new Set(filteredCommissions.map(commission => commission.customerEmail)).size
  };
};

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommissionSummary>(defaultSummary);
  const [affiliateOverviews, setAffiliateOverviews] = useState<AffiliateOverview[]>([]);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<number>(0);
  const [currentFetchKey, setCurrentFetchKey] = useState<string | null>(null);
  const [lastFetchedMonthYear, setLastFetchedMonthYear] = useState<string | null>(null);

  // Function for admin to fetch overview of all affiliates with retry mechanism
  const fetchAffiliateOverviews = useCallback(async (retryCount = 0, force = false) => {
    if (!isAuthenticated || !isAdmin) {
      setError("Not authorized to view affiliate overviews");
      return;
    }
    
    // Add throttling to prevent too many fetches in quick succession
    // Only fetch if it's been more than 5 seconds since the last fetch or if force=true
    const now = Date.now();
    if (!force && now - lastFetchTimestamp < 5000) {
      console.log("Skipping affiliate fetch - too soon since last fetch");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLastFetchTimestamp(now);

    try {
      console.log("Fetching affiliate overviews...");
      
      // Use RPC function to get affiliate data
      const { data, error } = await supabase.rpc('admin_get_affiliates');
      
      if (error) {
        console.error('RPC error:', error);
        toast.error('Failed to load affiliate data');
        
        // If we haven't tried too many times yet, retry after a delay
        if (retryCount < 2) {
          console.log(`Retrying... (${retryCount + 1})`);
          setTimeout(() => fetchAffiliateOverviews(retryCount + 1, true), 1000 * (retryCount + 1));
          return;
        }
        
        setAffiliateOverviews([]);
        throw error;
      }
      
      if (data && Array.isArray(data)) {
        // Process the data into the correct format with proper type casting
        const overviews: AffiliateOverview[] = data.map((item: any) => ({
          email: item.email || '',
          affiliateCode: item.affiliate_code || '',
          commissionRate: Number(item.commission_rate) || 0,
          totalCommission: Number(item.total_commission) || 0,
          totalSales: Number(item.total_sales) || 0,
          customerCount: Number(item.customer_count) || 0
        }));
        
        setAffiliateOverviews(overviews);
        console.log(`Received ${overviews.length} affiliate records`);
      } else {
        console.error('Unexpected data format from RPC:', data);
        setAffiliateOverviews([]);
      }
    } catch (err) {
      console.error("Error fetching affiliate overviews:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch affiliate data");
      setAffiliateOverviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isAdmin, lastFetchTimestamp]);

  const fetchCommissionData = useCallback(async (year: number, month: number, forceRefresh = false) => {
    if (!isAuthenticated || !user) {
      setError("User not authenticated");
      return;
    }

    // If the user is admin, they should call fetchAffiliateOverviews() instead
    if (isAdmin) {
      await fetchAffiliateOverviews();
      return;
    }

    // Regular affiliate user without an affiliate code
    if (!user.affiliateCode) {
      setError("User does not have an affiliate code");
      return;
    }

    // Generate a unique key for this fetch operation
    const fetchKey = `${user.affiliateCode}-${year}-${month}`;
    const monthYearKey = `${year}-${month}`;
    
    // Check if we're switching to a different month/year - if so, always fetch fresh data
    const isMonthYearChange = lastFetchedMonthYear !== monthYearKey;
    const shouldForceFetch = forceRefresh || isMonthYearChange;
    
    // Check if we're already fetching the same data
    if (currentFetchKey === fetchKey && isLoading && !shouldForceFetch) {
      console.log(`Already fetching data for ${fetchKey}, skipping duplicate request`);
      return;
    }
    
    // Update the tracked month/year
    setLastFetchedMonthYear(monthYearKey);
    setCurrentFetchKey(fetchKey);
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching data for ${user.affiliateCode}, year: ${year}, month: ${month}, forceRefresh: ${shouldForceFetch}, isMonthYearChange: ${isMonthYearChange}`);
      
      // If forcing refresh or switching months, sync data from Stripe first
      if (shouldForceFetch) {
        console.log("Force refresh or month change detected, syncing from Stripe...");
        
        const { error: syncError } = await supabase.functions.invoke("sync-stripe-data", {
          body: {
            year,
            month,
            forceRefresh: true
          }
        });

        if (syncError) {
          console.error("Error syncing Stripe data:", syncError);
          // Continue anyway, maybe we have some cached data
        } else {
          console.log("Stripe data sync completed");
        }
      }
      
      // Now fetch the data from our database
      const { data, error } = await supabase.functions.invoke<{
        commissions: Commission[];
        summary: CommissionSummary;
      }>("get-affiliate-data", {
        body: {
          affiliateCode: user.affiliateCode,
          year,
          month
        }
      });

      if (error) {
        console.error("Error fetching commission data:", error);
        setError(`Failed to fetch commission data: ${error.message}`);
        return;
      }

      if (!data) {
        setError("No data returned from API");
        return;
      }

      console.log(`Received ${data.commissions?.length || 0} commissions`);
      
      const rawCommissions = data.commissions || [];
      setCommissions(rawCommissions);
      
      // Calculate summary based on filtered commissions
      const calculatedSummary = calculateSummary(rawCommissions);
      setSummary(calculatedSummary);

    } catch (err) {
      console.error("Exception during commission fetch:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch commission data");
    } finally {
      setIsLoading(false);
      setCurrentFetchKey(null);
    }
  }, [isAuthenticated, user, isAdmin, fetchAffiliateOverviews, isLoading, currentFetchKey, lastFetchedMonthYear]);

  // Effect to fetch initial affiliate overview data for admin users with delayed initialization
  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated && isAdmin) {
      // Add a small delay to allow the auth context to fully initialize
      const timer = setTimeout(() => {
        if (isMounted) {
          fetchAffiliateOverviews(0, true);
        }
      }, 500);
      
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAdmin, fetchAffiliateOverviews]);

  // Reset tracking when the user changes
  useEffect(() => {
    if (user?.affiliateCode) {
      setLastFetchedMonthYear(null);
    }
  }, [user?.affiliateCode]);

  const value = {
    commissions,
    isLoading,
    error,
    summary,
    fetchCommissionData,
    affiliateOverviews,
    fetchAffiliateOverviews,
    isAdmin
  };

  return <AffiliateContext.Provider value={value}>{children}</AffiliateContext.Provider>;
};

export const useAffiliate = () => {
  const context = useContext(AffiliateContext);
  if (context === undefined) {
    throw new Error("useAffiliate must be used within an AffiliateProvider");
  }
  return context;
};
