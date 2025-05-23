
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

interface AffiliateContextType {
  commissions: Commission[];
  isLoading: boolean;
  error: string | null;
  summary: CommissionSummary;
  getMonthlyStats: (year: number, month: number) => Promise<MonthlyStats>;
  fetchCommissionData: (year: number, month: number) => Promise<void>;
  monthlyStats: Record<string, MonthlyStats>;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, MonthlyStats>>({});
  const [summary, setSummary] = useState<CommissionSummary>({
    totalRevenue: 0,
    totalCommission: 0,
    customerCount: 0,
  });

  const fetchCommissionData = async (year: number, month: number) => {
    if (!isAuthenticated || !user) {
      setError("User not authenticated");
      return;
    }

    if (!user.affiliateCode) {
      setError("User does not have an affiliate code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching data for ${user.affiliateCode}, year: ${year}, month: ${month}`);
      
      // Call our Supabase Edge Function to get the real data from Stripe
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

  const value = {
    commissions,
    isLoading,
    error,
    summary,
    getMonthlyStats,
    fetchCommissionData,
    monthlyStats,
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
