
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, DatabaseIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { UserManagement } from "@/components/admin/UserManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminNetworkOverview } from "@/components/admin/AdminNetworkOverview";

interface StripeSyncProgress {
  progress: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { fetchAffiliateOverviews } = useAffiliate();
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

    if (!initialDataFetched) {
      const timer = setTimeout(() => {
        fetchLastSyncTime();
        fetchAffiliateOverviews();
        setInitialDataFetched(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isAdmin, navigate, initialDataFetched, fetchAffiliateOverviews]);

  useEffect(() => {
    if (!syncingStripe) {
      if (progressPolling) {
        clearInterval(progressPolling);
        setProgressPolling(null);
      }
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value, updated_at')
          .eq('key', 'stripe_sync_progress')
          .single();
          
        if (!error && data) {
          const valueObj = data.value as unknown as StripeSyncProgress;
          if (valueObj && typeof valueObj.progress === 'number') {
            setSyncProgress(valueObj.progress);
            
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
    }, 2000);
    
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
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching last sync time:", error);
        return;
      }
      
      if (data) {
        setLastSyncTime(data.updated_at);
      }
    } catch (error) {
      console.error("Error fetching last sync time:", error);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await fetchAffiliateOverviews();
      toast.success("Data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
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
      await supabase
        .from('system_settings')
        .upsert({
          key: 'stripe_sync_progress',
          value: { progress: 0 },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      const { data, error } = await supabase.functions.invoke("sync-stripe-data", {
        method: "POST",
        body: { 
          fullRefresh,
          affiliateCode: 'admin'
        }
      });
      
      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }
      
      if (data) {
        toast.success(`Stripe data synced: ${data.stats?.saved || data.commissionsFound || 0} records processed`);
      } else {
        toast.warning("Sync completed but no statistics were returned");
      }
      
      fetchLastSyncTime();
      await fetchAffiliateOverviews();
    } catch (error) {
      console.error("Error syncing Stripe data:", error);
      toast.error(`Failed to sync Stripe data: ${error instanceof Error ? error.message : String(error)}`);
      setSyncingStripe(false);
      setSyncProgress(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Admin Control Center</h1>
              <p className="text-muted-foreground">
                Network oversight and system management
              </p>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Network Overview</TabsTrigger>
              <TabsTrigger value="management">System Management</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <AdminNetworkOverview />
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
