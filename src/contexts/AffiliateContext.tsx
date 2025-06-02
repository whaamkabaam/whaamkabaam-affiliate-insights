
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
    fetchAffiliateOverviews
  } = useAffiliateData(isAuthenticated, isAdmin, user);

  // Effect to fetch initial affiliate overview data for admin users with delayed initialization
  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated && isAdmin) {
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
