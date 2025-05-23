
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { InitializeUsers } from "@/components/InitializeUsers";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { affiliateOverviews, isLoading, fetchAffiliateOverviews } = useAffiliate();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAffiliateOverviews();
      toast.success("Affiliate data refreshed");
    } catch (error) {
      toast.error("Failed to refresh affiliate data");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="grid gap-6 p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InitializeUsers />
            
            <Card className="w-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Affiliates</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : affiliateOverviews.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {affiliateOverviews.map((affiliate, i) => (
                          <TableRow key={i}>
                            <TableCell>{affiliate.email}</TableCell>
                            <TableCell>{affiliate.affiliateCode}</TableCell>
                            <TableCell>{(affiliate.commissionRate * 100).toFixed(0)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
