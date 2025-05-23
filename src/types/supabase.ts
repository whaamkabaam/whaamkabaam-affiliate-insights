
export interface AffiliateRpcResponse {
  id: string;
  user_id: string;
  email: string;
  affiliate_code: string;
  commission_rate: number;
  total_commission: number;
  total_sales: number;
  customer_count: number;
  created_at: string;
}
