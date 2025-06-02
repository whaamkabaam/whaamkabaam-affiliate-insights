
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, DatabaseIcon, Users, DollarSign, TrendingUp, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { UserManagement } from "@/components/admin/UserManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

// Define a type for the stripe sync progress value structure
interface StripeSyncProgress {
  progress: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { affiliateOverviews, isLoading, fetchAffiliateOverviews } = useAffiliate();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [progressPolling, setProgressPolling] = useState<NodeJS.Timeout | null>(null);
  const [initialDataFetched, setInitialDataFetched] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    // Fetch initial data only once when component mounts
    if (!initialDataFetched) {
      const timer = setTimeout(() => {
        fetchLastSyncTime();
        fetchAffiliateOverviews();
        setInitialDataFetched(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isAdmin, navigate, initialDataFetched, fetchAffiliateOverviews]);

  // Effect for polling progress during sync
  useEffect(() => {
    if (!syncingStripe) {
      if (progressPolling) {
        clearInterval(progressPolling);
        setProgressPolling(null);
      }
      return;
    }

    // Start polling for progress updates if we're syncing
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value, updated_at')
          .eq('key', 'stripe_sync_progress')
          .single();
          
        if (!error && data) {
          // Properly type check and handle the value structure
          const valueObj = data.value as unknown as StripeSyncProgress;
          if (valueObj && typeof valueObj.progress === 'number') {
            setSyncProgress(valueObj.progress);
            
            // If progress is 100%, we're done
            if (valueObj.progress >= 100) {
              setSyncingStripe(false);
              fetchAffiliateOverviews();
              clearInterval(pollInterval);
              setProgressPolling(null);
            }
          }
        }
      } catch (err) {
        console.error("Error polling progress:", err);
      }
    }, 2000); // Poll every 2 seconds
    
    // Store the interval ID, not the interval itself
    setProgressPolling(pollInterval);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [syncingStripe, fetchAffiliateOverviews]);

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
    setSyncProgress(0);
    toast.info(fullRefresh ? "Starting full sync..." : "Starting incremental sync...");
    
    try {
      // Initialize the progress tracking
      await supabase
        .from('system_settings')
        .upsert({
          key: 'stripe_sync_progress',
          value: { progress: 0 },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      // Call the edge function using Supabase client for admin sync (all affiliates)
      const { data, error } = await supabase.functions.invoke("sync-stripe-data", {
        method: "POST",
        body: { 
          fullRefresh,
          affiliateCode: 'admin' // Admin syncs all data
        }
      });
      
      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }
      
      if (data) {
        toast.success(`Stripe data synced: ${data.stats?.saved || data.commissionsFound || 0} records processed, ${data.stats?.skipped || 0} skipped`);
      } else {
        toast.warning("Sync completed but no statistics were returned");
      }
      
      fetchLastSyncTime();
      // Only refresh affiliate overviews after the sync is complete
      await fetchAffiliateOverviews();
    } catch (error) {
      console.error("Error syncing Stripe data:", error);
      toast.error(`Failed to sync Stripe data: ${error instanceof Error ? error.message : String(error)}`);
      setSyncingStripe(false);
      setSyncProgress(null);
    }
  };

  // Calculate admin-level aggregated metrics
  const totalCommission = affiliateOverviews.reduce((sum, affiliate) => sum + (affiliate.totalCommission || 0), 0);
  const totalSales = affiliateOverviews.reduce((sum, affiliate) => sum + (affiliate.totalSales || 0), 0);
  const totalCustomers = affiliateOverviews.reduce((sum, affiliate) => sum + (affiliate.customerCount || 0), 0);
  const averageCommissionRate = affiliateOverviews.length > 0 
    ? affiliateOverviews.reduce((sum, affiliate) => sum + affiliate.commissionRate, 0) / affiliateOverviews.length 
    : 0;

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="p-6 space-y-6">
          {/* Header Section */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Admin Control Center</h1>
              <p className="text-muted-foreground">
                Complete oversight of affiliate network performance and system operations
              </p>
            </div>
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

          {/* Network Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Network Commission"
              value={`$${totalCommission.toFixed(2)}`}
              description="Total earned across all affiliates"
              icon={<DollarSign className="w-4 h-4" />}
              className="bg-primary/5"
            />
            <StatsCard
              title="Total Network Sales"
              value={`$${totalSales.toFixed(2)}`}
              description="Total revenue generated by affiliates"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatsCard
              title="Total Customers"
              value={totalCustomers}
              description="Total customers across all affiliates"
              icon={<Users className="w-4 h-4" />}
            />
            <StatsCard
              title="Active Affiliates"
              value={affiliateOverviews.length}
              description={`Avg rate: ${(averageCommissionRate * 100).toFixed(1)}%`}
              icon={<Target className="w-4 h-4" />}
            />
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="affiliates" className="space-y-4">
            <TabsList>
              <TabsTrigger value="affiliates">Affiliate Overview</TabsTrigger>
              <TabsTrigger value="management">System Management</TabsTrigger>
            </TabsList>
            
            <TabsContent value="affiliates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Affiliate Performance Dashboard</CardTitle>
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
                            <TableHead>Affiliate</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Commission Rate</TableHead>
                            <TableHead className="text-right">Total Sales</TableHead>
                            <TableHead className="text-right">Total Commission</TableHead>
                            <TableHead className="text-right">Customers</TableHead>
                            <TableHead className="text-right">Performance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {affiliateOverviews.map((affiliate, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{affiliate.email}</TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-secondary rounded text-sm">
                                  {affiliate.affiliateCode}
                                </span>
                              </TableCell>
                              <TableCell>{(affiliate.commissionRate * 100).toFixed(0)}%</TableCell>
                              <TableCell className="text-right">${affiliate.totalSales?.toFixed(2) || "0.00"}</TableCell>
                              <TableCell className="text-right font-medium">${affiliate.totalCommission?.toFixed(2) || "0.00"}</TableCell>
                              <TableCell className="text-right">{affiliate.customerCount || 0}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    (affiliate.totalSales || 0) > 1000 ? 'bg-green-500' :
                                    (affiliate.totalSales || 0) > 100 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`} />
                                  <span className="text-sm text-muted-foreground">
                                    {(affiliate.totalSales || 0) > 1000 ? 'High' :
                                     (affiliate.totalSales || 0) > 100 ? 'Medium' : 'Low'}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No affiliate data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="management" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UserManagement />
                
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

                      {syncingStripe && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Synchronizing data...</span>
                            <span className="text-muted-foreground">
                              {syncProgress !== null ? `${syncProgress.toFixed(0)}%` : "In progress"}
                            </span>
                          </div>
                          <Progress value={syncProgress ?? 30} className="h-2" />
                        </div>
                      )}
                      
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
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
