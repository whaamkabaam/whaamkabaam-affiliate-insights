
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AffiliateOverview } from "@/types/supabase";
import { toast } from "sonner";

interface AffiliateContextType {
  summary: any;
  data: any[];
  isLoading: boolean;
  error: string | null;
  selectedPeriod: { year: number; month: number };
  affiliateOverviews: AffiliateOverview[];
  fetchData: (affiliateCode: string, year: number, month: number) => Promise<void>;
  setSelectedPeriod: (period: { year: number; month: number }) => void;
  fetchAffiliateOverviews: () => Promise<void>;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState({ year: 0, month: 0 });
  const [affiliateOverviews, setAffiliateOverviews] = useState<AffiliateOverview[]>([]);

  const fetchData = async (affiliateCode: string, year: number, month: number) => {
    console.log(`Fetching data for ${affiliateCode}, year: ${year}, month: ${month}, shouldSync: true`);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Syncing from Stripe...");
      const { data: syncResult, error: syncError } = await supabase.functions.invoke("get-affiliate-data", {
        body: { 
          affiliateCode,
          year: year.toString(),
          month: month.toString(),
          forceRefresh: true
        }
      });

      if (syncError) {
        console.error("Sync error:", syncError);
        throw syncError;
      }

      console.log("Sync completed, result:", syncResult);
      setSummary(syncResult?.summary || null);
      setData(syncResult?.data || []);
      
    } catch (err: any) {
      console.error("Error in fetchData:", err);
      setError(err.message || "Failed to fetch data");
      toast.error(`Failed to fetch data: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAffiliateOverviews = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_affiliates');
      
      if (error) {
        console.error("Error fetching affiliate overviews:", error);
        toast.error(`Failed to fetch affiliate data: ${error.message}`);
        return;
      }
      
      if (data) {
        const overviews = data.map((item: any) => ({
          email: item.email,
          affiliateCode: item.affiliate_code,
          commissionRate: item.commission_rate,
          totalCommission: item.total_commission || 0,
          totalSales: item.total_sales || 0,
          customerCount: item.customer_count || 0
        }));
        
        setAffiliateOverviews(overviews);
        console.log("Fetched affiliate overviews:", overviews);
      }
    } catch (err: any) {
      console.error("Error fetching affiliate overviews:", err);
      toast.error("Failed to fetch affiliate overviews");
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    summary,
    data,
    isLoading,
    error,
    selectedPeriod,
    affiliateOverviews,
    fetchData,
    setSelectedPeriod,
    fetchAffiliateOverviews
  };

  return (
    <AffiliateContext.Provider value={value}>
      {children}
    </AffiliateContext.Provider>
  );
};

export const useAffiliate = () => {
  const context = useContext(AffiliateContext);
  if (context === undefined) {
    throw new Error("useAffiliate must be used within an AffiliateProvider");
  }
  return context;
};
