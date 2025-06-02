
import { Commission, CommissionSummary } from "@/types/affiliate";

// Helper function to filter out hardcoded example data and $0 commissions
export const filterCommissions = (commissions: Commission[], affiliateCode?: string): Commission[] => {
  return commissions.filter(commission => {
    // Filter out hardcoded example data
    if (!commission.customerEmail || 
        commission.customerEmail.includes('unknown@example.com') ||
        commission.customerEmail.includes('example.com') ||
        commission.customerEmail === 'unknown@example.com') {
      return false;
    }
    
    // Filter out $0 commissions
    if (commission.commission <= 0) {
      return false;
    }
    
    // For Ayoub, filter out sales before May 20, 2025
    if (affiliateCode === 'ayoub') {
      const ayoubStartDate = new Date('2025-05-20T00:00:00Z');
      const commissionDate = new Date(commission.date);
      if (commissionDate < ayoubStartDate) {
        console.log(`Filtering out Ayoub commission from ${commissionDate.toISOString()} (before ${ayoubStartDate.toISOString()})`);
        return false;
      }
    }
    
    return true;
  });
};

// Helper function to calculate summary from filtered commissions
export const calculateSummary = (commissions: Commission[], affiliateCode?: string): CommissionSummary => {
  const filteredCommissions = filterCommissions(commissions, affiliateCode);
  
  return {
    totalCommission: filteredCommissions.reduce((sum, commission) => sum + commission.commission, 0),
    customerCount: new Set(filteredCommissions.map(commission => commission.customerEmail)).size
  };
};

export const defaultSummary: CommissionSummary = {
  totalCommission: 0,
  customerCount: 0
};
