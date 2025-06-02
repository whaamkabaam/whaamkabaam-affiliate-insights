
import { createContext, useContext, ReactNode, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { AffiliateContextType } from "@/types/affiliate";
import { useAffiliateData } from "@/hooks/useAffiliateData";

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  
  const {
    commissions,
    isLoading,
    error,
    summary,
    affiliateOverviews,
    fetchCommissionData,
    fetchAffiliateOverviews,
    setLastFetchedMonthYear
  } = useAffiliateData(isAuthenticated, isAdmin, user);

  // Remove the automatic fetching that was causing the infinite loop
  // Admin dashboard will manually call fetchAffiliateOverviews when needed

  // Reset tracking when the user changes
  useEffect(() => {
    if (user?.affiliateCode) {
      setLastFetchedMonthYear(null);
    }
  }, [user?.affiliateCode, setLastFetchedMonthYear]);

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

// Re-export types for backwards compatibility
export type { Commission, CommissionSummary, AffiliateOverview } from "@/types/affiliate";
