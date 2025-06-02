
import { Commission, CommissionSummary } from "@/types/affiliate";

// Helper function to filter out hardcoded example data
export const filterCommissions = (commissions: Commission[]): Commission[] => {
  return commissions.filter(commission => 
    commission.customerEmail && 
    !commission.customerEmail.includes('unknown@example.com') &&
    !commission.customerEmail.includes('example.com') &&
    commission.customerEmail !== 'unknown@example.com'
  );
};

// Helper function to calculate summary from filtered commissions
export const calculateSummary = (commissions: Commission[]): CommissionSummary => {
  const filteredCommissions = filterCommissions(commissions);
  
  return {
    totalCommission: filteredCommissions.reduce((sum, commission) => sum + commission.commission, 0),
    customerCount: new Set(filteredCommissions.map(commission => commission.customerEmail)).size
  };
};

export const defaultSummary: CommissionSummary = {
  totalCommission: 0,
  customerCount: 0
};
