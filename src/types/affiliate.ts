
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
  totalCommission: number;
  customerCount: number;
}

export interface AffiliateOverview {
  email: string;
  affiliateCode: string;
  commissionRate: number;
  totalCommission: number;
  totalSales: number;
  customerCount: number;
}

export interface AffiliateContextType {
  commissions: Commission[];
  isLoading: boolean;
  error: string | null;
  summary: CommissionSummary;
  fetchCommissionData: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  affiliateOverviews: AffiliateOverview[];
  fetchAffiliateOverviews: () => Promise<void>;
  isAdmin: boolean;
}
