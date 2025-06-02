
import { useState, useCallback, useRef } from "react";
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
  
  // Track ongoing fetch operations to prevent duplicates
  const ongoingFetches = useRef<Set<string>>(new Set());

  // Function for admin to fetch overview of all affiliates with retry mechanism
  const fetchAffiliateOverviews = useCallback(async (retryCount = 0, force = false) => {
    if (!isAuthenticated || !isAdmin) {
      setError("Not authorized to view affiliate overviews");
      return;
    }
    
    // Add throttling to prevent too many fetches in quick succession
    const now = Date.now();
    if (!force && now - lastFetchTimestamp < 5000) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLastFetchTimestamp(now);

    try {
      const { data, error } = await supabase.rpc('admin_get_affiliates');
      
      if (error) {
        toast.error('Failed to load affiliate data');
        
        if (retryCount < 2) {
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
      } else {
        setAffiliateOverviews([]);
      }
    } catch (err) {
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
    
    // Prevent duplicate fetches for the same key
    if (ongoingFetches.current.has(fetchKey)) {
      return;
    }

    const isMonthYearChange = lastFetchedMonthYear !== monthYearKey;
    
    // OPTIMIZED: Only sync when explicitly requested or for current month data
    const currentDate = new Date();
    const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
    const shouldSync = forceRefresh || (isCurrentMonth && isMonthYearChange);
    
    setLastFetchedMonthYear(monthYearKey);
    setCurrentFetchKey(fetchKey);
    setIsLoading(true);
    setError(null);
    
    // Mark this fetch as ongoing
    ongoingFetches.current.add(fetchKey);

    try {
      if (shouldSync) {
        const { error: syncError } = await supabase.functions.invoke("sync-stripe-data", {
          body: {
            year,
            month,
            forceRefresh,
            affiliateCode: user.affiliateCode
          }
        });

        if (syncError) {
          // Silent error for production - sync failures shouldn't break the UI
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
        setError(`Failed to fetch commission data: ${error.message}`);
        return;
      }

      if (!data) {
        setError("No data returned from API");
        return;
      }

      const rawCommissions = data.commissions || [];
      setCommissions(rawCommissions);
      
      // Calculate summary with affiliate-specific filtering
      const calculatedSummary = calculateSummary(rawCommissions, user.affiliateCode);
      setSummary(calculatedSummary);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch commission data");
    } finally {
      setIsLoading(false);
      setCurrentFetchKey(null);
      // Remove from ongoing fetches
      ongoingFetches.current.delete(fetchKey);
    }
  }, [isAuthenticated, user, isAdmin, fetchAffiliateOverviews, lastFetchedMonthYear]);

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
