
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
import { RefreshCw, DatabaseIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { affiliateOverviews, isLoading, fetchAffiliateOverviews, error } = useAffiliate();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    // Fetch affiliate data after a short delay
    const timer = setTimeout(() => {
      fetchAffiliateOverviews();
      fetchLastSyncTime();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, isAdmin, navigate, fetchAffiliateOverviews]);
  
  // Display any errors that might occur
  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error}`);
    }
  }, [error]);

  const fetchLastSyncTime = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value, updated_at')
        .eq('key', 'last_stripe_refresh')
        .single();
      
      if (error) throw error;
      
      if (data) {
        setLastSyncTime(data.updated_at);
      }
    } catch (error) {
      console.error("Error fetching last sync time:", error);
    }
  };

  const handleRefresh = async () => {
    if (isLoading || refreshing) return;
    
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

  const syncStripeData = async (fullRefresh: boolean = false) => {
    if (syncingStripe) return;
    
    setSyncingStripe(true);
    try {
      // Get the access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }
      
      toast.info(fullRefresh ? "Starting full sync..." : "Starting incremental sync...");
      
      // Call the edge function through the Supabase client instead of direct fetch
      const { data, error } = await supabase.functions.invoke("sync-stripe-data", {
        method: "POST",
        body: { fullRefresh }
      });
      
      if (error) throw error;
      
      if (data) {
        toast.success(`Stripe data synced: ${data.stats.saved} records processed, ${data.stats.skipped} skipped`);
      } else {
        toast.warning("Sync completed but no statistics were returned");
      }
      
      fetchLastSyncTime();
      fetchAffiliateOverviews();
    } catch (error) {
      console.error("Error syncing Stripe data:", error);
      toast.error(`Failed to sync Stripe data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncingStripe(false);
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
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Earned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {affiliateOverviews.map((affiliate, i) => (
                          <TableRow key={i}>
                            <TableCell>{affiliate.email}</TableCell>
                            <TableCell>{affiliate.affiliateCode}</TableCell>
                            <TableCell>{(affiliate.commissionRate * 100).toFixed(0)}%</TableCell>
                            <TableCell className="text-right">${affiliate.totalSales?.toFixed(2) || "0.00"}</TableCell>
                            <TableCell className="text-right">${affiliate.totalCommission?.toFixed(2) || "0.00"}</TableCell>
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
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DatabaseIcon className="h-5 w-5 mr-2" /> 
                Stripe Data Synchronization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {lastSyncTime ? (
                    <p>Last synchronized: {new Date(lastSyncTime).toLocaleString()}</p>
                  ) : (
                    <p>No synchronization history available.</p>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={() => syncStripeData(false)}
                    disabled={syncingStripe}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingStripe ? "animate-spin" : ""}`} />
                    Sync New Data
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    onClick={() => syncStripeData(true)}
                    disabled={syncingStripe}
                  >
                    <DatabaseIcon className="h-4 w-4 mr-2" />
                    Full Sync (All Data)
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  "Sync New Data" will only fetch Stripe sessions since the last sync. "Full Sync" will fetch all historical data.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
