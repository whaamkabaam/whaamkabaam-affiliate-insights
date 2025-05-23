
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
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
  totalRevenue: number;
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

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, MonthlyStats>>({});
  const [summary, setSummary] = useState<CommissionSummary>({
    totalRevenue: 0,
    totalCommission: 0,
    customerCount: 0,
  });
  const [affiliateOverviews, setAffiliateOverviews] = useState<AffiliateOverview[]>([]);

  // Function for admin to fetch overview of all affiliates
  const fetchAffiliateOverviews = async () => {
    if (!isAuthenticated || !isAdmin) {
      setError("Not authorized to view affiliate overviews");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use RPC function to get affiliate data
      const { data, error } = await supabase.rpc('admin_get_affiliates');
      
      if (error) {
        console.error('RPC error:', error);
        toast.error('Failed to load affiliate data');
        setAffiliateOverviews([]);
        return;
      }
      
      if (data && Array.isArray(data)) {
        // Process the data into the correct format with proper type casting
        const overviews: AffiliateOverview[] = data.map((item: any) => ({
          email: item.email || '',
          affiliateCode: item.affiliate_code || '',
          commissionRate: Number(item.commission_rate) || 0,
          totalCommission: Number(item.total_commission) || 0,
          totalRevenue: Number(item.total_sales) || 0,
          customerCount: Number(item.customer_count) || 0
        }));
        
        setAffiliateOverviews(overviews);
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
  };

  const fetchCommissionData = async (year: number, month: number) => {
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
      setSummary({
        totalRevenue: 0,
        totalCommission: 0,
        customerCount: 0,
      });
      
      return;
    }

    // Regular affiliate user without an affiliate code
    if (!user.affiliateCode) {
      setError("User does not have an affiliate code");
      return;
    }

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
          affiliateCode: user.affiliateCode,
          year,
          month
        }
      });

      if (error) {
        console.error("Error fetching commission data:", error);
        setError(`Failed to fetch commission data: ${error.message}`);
        setCommissions([]);
        setSummary({
          totalRevenue: 0,
          totalCommission: 0,
          customerCount: 0,
        });
        return;
      }

      if (!data) {
        setError("No data returned from API");
        setCommissions([]);
        setSummary({
          totalRevenue: 0,
          totalCommission: 0,
          customerCount: 0,
        });
        return;
      }

      console.log(`Received ${data.commissions?.length || 0} commissions`);
      
      setCommissions(data.commissions || []);
      setSummary(data.summary || {
        totalRevenue: 0,
        totalCommission: 0,
        customerCount: 0,
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
      setCommissions([]);
      setSummary({
        totalRevenue: 0,
        totalCommission: 0,
        customerCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthlyStats = async (year: number, month: number): Promise<MonthlyStats> => {
    // Skip for admin users
    if (isAdmin) {
      return { totalCommission: 0, customerCount: 0 };
    }
    
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (monthlyStats[key]) {
      return monthlyStats[key];
    }
    
    try {
      await fetchCommissionData(year, month);
      return monthlyStats[key] || { totalCommission: 0, customerCount: 0 };
    } catch (error) {
      console.error(`Error in getMonthlyStats for ${year}-${month}:`, error);
      return { totalCommission: 0, customerCount: 0 };
    }
  };

  // Effect to fetch initial affiliate overview data for admin users
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchAffiliateOverviews();
    }
  }, [isAuthenticated, isAdmin]);

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
