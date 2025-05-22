
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
        // Use RPC function to get affiliate data
        const { data, error } = await supabase.rpc('admin_get_affiliates');
        
        if (error) {
          console.error('RPC error:', error);
          
          // Fallback logic using direct queries if RPC fails
          try {
            // This is a fallback approach using direct data queries
            const { data: directData, error: directError } = await supabase.rpc('get_all_affiliates');

            if (directError) {
              throw directError;
            }
            
            if (directData) {
              // Process the direct data manually
              const enrichedAffiliates = await Promise.all(
                directData.map(async (affiliate: any) => {
                  // Get all affiliate data and enrich it
                  const email = affiliate.email || 'Unknown';
                  const commissionData = await supabase.rpc('get_affiliate_commission_data', { 
                    affiliate_id: affiliate.id 
                  });
                  
                  const customerCount = await supabase.rpc('count_affiliate_customers', { 
                    affiliate_code: affiliate.affiliate_code 
                  });
                  
                  return {
                    ...affiliate,
                    email: email,
                    total_commission: commissionData?.data?.total_commission || 0,
                    total_sales: commissionData?.data?.total_sales || 0,
                    customer_count: customerCount?.data || 0
                  };
                })
              );
              
              setAffiliates(enrichedAffiliates);
            }
          } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            toast.error('Failed to load affiliate data');
          }
        } else if (data) {
          // If RPC function worked, use that data
          setAffiliates(data);
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
