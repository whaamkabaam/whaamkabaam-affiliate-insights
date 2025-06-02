
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AffiliateOverview } from "@/types/supabase";
import { toast } from "sonner";
import { useAffiliateData } from "@/hooks/useAffiliateData";
import { useAuth } from "@/contexts/AuthContext";

interface AffiliateContextType {
  summary: any;
  data: any[];
  commissions: any[];
  isLoading: boolean;
  error: string | null;
  selectedPeriod: { year: number; month: number };
  affiliateOverviews: AffiliateOverview[];
  isAdmin: boolean;
  fetchData: (affiliateCode: string, year: number, month: number) => Promise<void>;
  fetchCommissionData: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  setSelectedPeriod: (period: { year: number; month: number }) => void;
  fetchAffiliateOverviews: () => Promise<void>;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState({ year: 0, month: 0 });
  
  // Use the custom hook for affiliate data management
  const {
    commissions,
    isLoading,
    error,
    summary,
    affiliateOverviews,
    fetchCommissionData,
    fetchAffiliateOverviews
  } = useAffiliateData(isAuthenticated, isAdmin, user);

  // Legacy fetchData method for backward compatibility
  const fetchData = async (affiliateCode: string, year: number, month: number) => {
    console.log(`Legacy fetchData called for ${affiliateCode}, year: ${year}, month: ${month}`);
    await fetchCommissionData(year, month, true);
  };

  const value = {
    summary,
    data: commissions, // Map commissions to data for backward compatibility
    commissions,
    isLoading,
    error,
    selectedPeriod,
    affiliateOverviews,
    isAdmin,
    fetchData,
    fetchCommissionData,
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
