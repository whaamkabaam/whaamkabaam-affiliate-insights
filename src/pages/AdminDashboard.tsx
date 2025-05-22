import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase, AffiliateJson } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InitializeUsers } from "@/components/InitializeUsers";

interface EnrichedAffiliate {
  id: string;
  user_id: string;
  email?: string;
  affiliate_code: string;
  commission_rate: number;
  total_commission?: number;
  total_sales?: number;
  customer_count?: number;
  created_at: string;
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
          toast.error('Failed to load affiliate data');
          setAffiliates([]);
          return;
        }
        
        if (data && Array.isArray(data)) {
          // Process the RPC data into the correct format
          const processedAffiliates: EnrichedAffiliate[] = data.map(item => {
            // Safely cast and access the JSON properties
            const affiliateJson = item as unknown as AffiliateJson;
            return {
              id: affiliateJson.id || '',
              user_id: affiliateJson.user_id || '',
              affiliate_code: affiliateJson.affiliate_code || '',
              commission_rate: Number(affiliateJson.commission_rate) || 0,
              created_at: affiliateJson.created_at || '',
              email: affiliateJson.email || '',
              total_commission: Number(affiliateJson.total_commission) || 0,
              total_sales: Number(affiliateJson.total_sales) || 0,
              customer_count: Number(affiliateJson.customer_count) || 0
            };
          });
          
          setAffiliates(processedAffiliates);
        } else {
          // Handle case where data is not an array
          console.error('Unexpected data format from RPC:', data);
          setAffiliates([]);
        }
      } catch (error: any) {
        console.error('Error fetching affiliates:', error);
        toast.error('Failed to load affiliate data');
        setAffiliates([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAffiliates();
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="grid gap-6 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InitializeUsers />
            
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Affiliates</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : affiliates.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-muted">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Code</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-muted">
                        {affiliates.map((affiliate, i) => (
                          <tr key={affiliate.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{affiliate.email}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{affiliate.affiliate_code}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{(affiliate.commission_rate * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No affiliates found. Use the Initialize Users function to create test affiliates.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
