
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase, Affiliate } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrichedAffiliate extends Affiliate {
  email?: string;
  total_commission?: number;
  total_sales?: number;
  customer_count?: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const [affiliates, setAffiliates] = useState<EnrichedAffiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    const fetchAffiliates = async () => {
      try {
        setIsLoading(true);
        // Use raw query to avoid type issues - supabase doesn't know about our new tables
        const { data, error } = await supabase
          .from('affiliates')
          .select('*');

        if (error) throw error;
          
        if (data) {
          // Process the direct data
          const enrichedAffiliates = await Promise.all(
            data.map(async (affiliate: any) => {
              try {
                // Get email from profiles
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('email')
                  .eq('id', affiliate.id)
                  .maybeSingle();
                
                // Count the number of customers referred by this affiliate
                const { count: customers } = await supabase
                  .from('customers')
                  .select('*', { count: 'exact', head: true })
                  .eq('referred_by', affiliate.affiliate_code);
                  
                const customerCount = customers || 0;

                // Get commission data
                const { data: commissionData } = await supabase
                  .from('commissions')
                  .select('amount, total_sale')
                  .eq('affiliate_id', affiliate.id);
                  
                let totalCommission = 0;
                let totalSales = 0;
                
                if (commissionData && commissionData.length > 0) {
                  totalCommission = commissionData.reduce((sum, item) => sum + Number(item.amount), 0);
                  totalSales = commissionData.reduce((sum, item) => sum + Number(item.total_sale), 0);
                }
                
                return {
                  ...affiliate,
                  email: profileData?.email || 'Unknown',
                  total_commission: totalCommission,
                  total_sales: totalSales,
                  customer_count: customerCount
                };
              } catch (enrichError) {
                console.error('Error enriching affiliate data:', enrichError);
                return {
                  ...affiliate, 
                  email: 'Error loading data',
                  total_commission: 0,
                  total_sales: 0,
                  customer_count: 0
                };
              }
            })
          );
          setAffiliates(enrichedAffiliates);
        }
      } catch (error: any) {
        console.error('Error fetching affiliates:', error);
        toast.error('Failed to load affiliate data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAffiliates();
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all affiliate performance
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Affiliate Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Affiliate</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Code</th>
                        <th className="text-right p-2">Commission Rate</th>
                        <th className="text-right p-2">Total Sales</th>
                        <th className="text-right p-2">Total Commission</th>
                        <th className="text-right p-2">Customers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {affiliates.map((affiliate) => (
                        <tr key={affiliate.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">Affiliate {affiliate.affiliate_code}</td>
                          <td className="p-2">{affiliate.email}</td>
                          <td className="p-2">{affiliate.affiliate_code}</td>
                          <td className="text-right p-2">{(Number(affiliate.commission_rate) * 100).toFixed(0)}%</td>
                          <td className="text-right p-2">${affiliate.total_sales?.toFixed(2) || '0.00'}</td>
                          <td className="text-right p-2">${affiliate.total_commission?.toFixed(2) || '0.00'}</td>
                          <td className="text-right p-2">{affiliate.customer_count || 0}</td>
                        </tr>
                      ))}
                      {affiliates.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center p-4">No affiliates found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
