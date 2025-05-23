
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

export interface MonthlyStats {
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
  getMonthlyStats: (year: number, month: number) => Promise<MonthlyStats>;
  fetchCommissionData: (year: number, month: number) => Promise<void>;
  monthlyStats: Record<string, MonthlyStats>;
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

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, MonthlyStats>>({});
  const [summary, setSummary] = useState<CommissionSummary>(defaultSummary);
  const [affiliateOverviews, setAffiliateOverviews] = useState<AffiliateOverview[]>([]);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<number>(0);
  const [currentFetchKey, setCurrentFetchKey] = useState<string | null>(null);
  const [fetchedMonthYearCombos, setFetchedMonthYearCombos] = useState<Set<string>>(new Set());

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

  const fetchCommissionData = useCallback(async (year: number, month: number) => {
    if (!isAuthenticated || !user) {
      setError("User not authenticated");
      return;
    }

    // If the user is admin, they don't have personal affiliate data
    // but we should still load the affiliate overviews for them
    if (isAdmin) {
      await fetchAffiliateOverviews();
      
      // Set empty commission data for admin users
      setCommissions([]);
      setSummary(defaultSummary);
      
      return;
    }

    // Regular affiliate user without an affiliate code
    if (!user.affiliateCode) {
      setError("User does not have an affiliate code");
      return;
    }

    // Generate a unique key for this fetch operation to prevent duplicate fetches
    const fetchKey = `${user.affiliateCode}-${year}-${month}`;
    
    // Check if we've already fetched this month's data
    if (fetchedMonthYearCombos.has(fetchKey)) {
      console.log(`Already fetched data for ${fetchKey}, using cached data`);
      return;
    }
    
    // Check if we're already fetching the same data
    if (currentFetchKey === fetchKey && isLoading) {
      console.log(`Already fetching data for ${fetchKey}`);
      return;
    }
    
    setCurrentFetchKey(fetchKey);
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching data for ${user.affiliateCode}, year: ${year}, month: ${month}`);
      
      // For regular affiliates, call our Supabase Edge Function to get their data
      const { data, error } = await supabase.functions.invoke<{
        commissions: Commission[];
        summary: CommissionSummary;
      }>("get-affiliate-data", {
        body: {
          // Ensure the affiliate code is properly passed as-is (whether uppercase or lowercase)
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
      
      setCommissions(data.commissions || []);
      setSummary(data.summary || defaultSummary);
      
      // Add this fetch to our tracking set
      setFetchedMonthYearCombos(prev => {
        const newSet = new Set(prev);
        newSet.add(fetchKey);
        return newSet;
      });
      
      // Update monthly stats
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      const newMonthlyStats = {
        totalCommission: data.summary?.totalCommission || 0,
        customerCount: data.summary?.customerCount || 0
      };
      
      setMonthlyStats(prev => ({
        ...prev,
        [key]: newMonthlyStats
      }));

    } catch (err) {
      console.error("Exception during commission fetch:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch commission data");
    } finally {
      setIsLoading(false);
      setCurrentFetchKey(null);
    }
  }, [isAuthenticated, user, isAdmin, fetchAffiliateOverviews, isLoading, currentFetchKey, fetchedMonthYearCombos]);

  const getMonthlyStats = useCallback(async (year: number, month: number): Promise<MonthlyStats> => {
    // Skip for admin users
    if (isAdmin) {
      return { totalCommission: 0, customerCount: 0 };
    }
    
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (monthlyStats[key]) {
      return monthlyStats[key];
    }
    
    // Generate a fetch key to check if we've already attempted to fetch this data
    const fetchKey = `${user?.affiliateCode}-${year}-${month}`;
    if (fetchedMonthYearCombos.has(fetchKey)) {
      // Return existing stats or defaults if no data was found
      return monthlyStats[key] || { totalCommission: 0, customerCount: 0 };
    }
    
    try {
      await fetchCommissionData(year, month);
      return monthlyStats[key] || { totalCommission: 0, customerCount: 0 };
    } catch (error) {
      console.error(`Error in getMonthlyStats for ${year}-${month}:`, error);
      return { totalCommission: 0, customerCount: 0 };
    }
  }, [isAdmin, monthlyStats, user?.affiliateCode, fetchedMonthYearCombos, fetchCommissionData]);

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

  // Reset the fetch tracking when the user changes
  useEffect(() => {
    if (user?.affiliateCode) {
      setFetchedMonthYearCombos(new Set());
    }
  }, [user?.affiliateCode]);

  const value = {
    commissions,
    isLoading,
    error,
    summary,
    getMonthlyStats,
    fetchCommissionData,
    monthlyStats,
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
