
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Commission, CommissionSummary, AffiliateOverview } from "@/types/affiliate";
import { calculateSummary } from "@/utils/affiliateUtils";

export const useAffiliateData = (
  isAuthenticated: boolean,
  isAdmin: boolean,
  user: any
) => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommissionSummary>({ totalCommission: 0, customerCount: 0 });
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
      
      const { data, error } = await supabase.rpc('admin_get_affiliates');
      
      if (error) {
        console.error('RPC error:', error);
        toast.error('Failed to load affiliate data');
        
        if (retryCount < 2) {
          console.log(`Retrying... (${retryCount + 1})`);
          setTimeout(() => fetchAffiliateOverviews(retryCount + 1, true), 1000 * (retryCount + 1));
          return;
        }
        
        setAffiliateOverviews([]);
        throw error;
      }
      
      if (data && Array.isArray(data)) {
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

    if (isAdmin) {
      await fetchAffiliateOverviews();
      return;
    }

    if (!user.affiliateCode) {
      setError("User does not have an affiliate code");
      return;
    }

    const fetchKey = `${user.affiliateCode}-${year}-${month}`;
    const monthYearKey = `${year}-${month}`;
    
    const isMonthYearChange = lastFetchedMonthYear !== monthYearKey;
    const shouldForceFetch = forceRefresh || isMonthYearChange;
    
    if (currentFetchKey === fetchKey && isLoading && !shouldForceFetch) {
      console.log(`Already fetching data for ${fetchKey}, skipping duplicate request`);
      return;
    }
    
    setLastFetchedMonthYear(monthYearKey);
    setCurrentFetchKey(fetchKey);
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching data for ${user.affiliateCode}, year: ${year}, month: ${month}, forceRefresh: ${shouldForceFetch}, isMonthYearChange: ${isMonthYearChange}`);
      
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
        } else {
          console.log("Stripe data sync completed");
        }
      }
      
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

  return {
    commissions,
    isLoading,
    error,
    summary,
    affiliateOverviews,
    fetchCommissionData,
    fetchAffiliateOverviews,
    setLastFetchedMonthYear
  };
};
