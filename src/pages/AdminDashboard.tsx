
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { InitializeUsers } from "@/components/InitializeUsers";

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { affiliateOverviews, isLoading, fetchAffiliateOverviews } = useAffiliate();
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

    // Fetch affiliate data when component mounts
    fetchAffiliateOverviews();
  }, [isAuthenticated, isAdmin, navigate, fetchAffiliateOverviews]);

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
                ) : affiliateOverviews.length > 0 ? (
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
                        {affiliateOverviews.map((affiliate, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{affiliate.email}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{affiliate.affiliateCode}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">{(affiliate.commissionRate * 100).toFixed(0)}%</td>
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
