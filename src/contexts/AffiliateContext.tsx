
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "./AuthContext";

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

// Mock data generation function
const generateMockData = (affiliateCode: string, year: number, month: number) => {
  // Generate between 5 and 15 random commissions
  const count = Math.floor(Math.random() * 10) + 5;
  const commissions: Commission[] = [];
  
  // Product options based on the script data
  const products = [
    { id: "prod_RINKAvP3L2kZeV", price: 35.10, commission: 7.80 },
    { id: "prod_RINJvQw1Qw1Qw1Q", price: 42.30, commission: 9.40 },
    { id: "prod_RINO6yE0y4O9gX", price: 116.10, commission: 29.80 },
  ];

  // Special case for ayoub
  const productForAyoub = { id: "prod_RINO6yE0y4O9gX", price: 149.00, commission: 20.00 };
  
  // Generate random data for the given month
  for (let i = 0; i < count; i++) {
    const day = Math.floor(Math.random() * 28) + 1;
    const date = new Date(year, month - 1, day);
    
    // Select product based on affiliate code
    let product;
    if (affiliateCode === 'ayoub') {
      product = productForAyoub;
    } else {
      product = products[Math.floor(Math.random() * products.length)];
    }
    
    commissions.push({
      sessionId: `cs_${Math.random().toString(36).substring(2, 15)}`,
      paymentIntent: `pi_${Math.random().toString(36).substring(2, 15)}`,
      customerEmail: `customer${i}@example.com`,
      amount: product.price,
      commission: product.commission,
      date: date.toISOString(),
      productId: product.id,
    });
  }

  return commissions;
};

export const AffiliateProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, MonthlyStats>>({});

  const fetchCommissionData = async (year: number, month: number) => {
    if (!isAuthenticated || !user) {
      setError("User not authenticated");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // In a real app, this would be an API call with the Stripe key
      // For now, we'll generate mock data
      const mockData = generateMockData(user.affiliateCode, year, month);
      setCommissions(mockData);
      
      // Update monthly stats
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      const totalCommission = mockData.reduce((total, item) => total + item.commission, 0);
      const uniqueCustomers = new Set(mockData.map(item => item.customerEmail)).size;
      
      setMonthlyStats(prev => ({
        ...prev,
        [key]: {
          totalCommission,
          customerCount: uniqueCustomers
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch commission data");
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthlyStats = async (year: number, month: number): Promise<MonthlyStats> => {
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (monthlyStats[key]) {
      return monthlyStats[key];
    }
    
    await fetchCommissionData(year, month);
    return monthlyStats[key] || { totalCommission: 0, customerCount: 0 };
  };

  // Calculate summary from commissions
  const summary: CommissionSummary = {
    totalRevenue: commissions.reduce((total, item) => total + item.amount, 0),
    totalCommission: commissions.reduce((total, item) => total + item.commission, 0),
    customerCount: new Set(commissions.map(item => item.customerEmail)).size,
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
