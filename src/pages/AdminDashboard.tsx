import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, DatabaseIcon, Users, Copy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

// Define a type for the stripe sync progress value structure
interface StripeSyncProgress {
  progress: number;
}

interface UserCredential {
  email: string;
  name: string;
  password: string;
}

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const { affiliateOverviews, isLoading, fetchAffiliateOverviews, error } = useAffiliate();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [progressPolling, setProgressPolling] = useState<NodeJS.Timeout | null>(null);
  const [userCredentials, setUserCredentials] = useState<UserCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    // Only fetch last sync time, remove the duplicate fetchAffiliateOverviews call
    // that was causing the re-rendering loop
    const timer = setTimeout(fetchLastSyncTime, 500);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, isAdmin, navigate]);
  
  // Display any errors that might occur
  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error}`);
    }
  }, [error]);

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
  }, [syncingStripe]);

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
      
      // Call the edge function using Supabase client
      const { data, error } = await supabase.functions.invoke("sync-stripe-data", {
        method: "POST",
        body: { fullRefresh }
      });
      
      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }
      
      if (data) {
        toast.success(`Stripe data synced: ${data.stats.saved} records processed, ${data.stats.skipped} skipped`);
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

  const getUserCredentials = async () => {
    setLoadingCredentials(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-initial-users", {
        method: "POST",
        body: { user: user }
      });
      
      if (error) {
        console.error("Error getting credentials:", error);
        toast.error("Failed to get user credentials");
        return;
      }
      
      if (data && data.users) {
        setUserCredentials(data.users);
        toast.success("User credentials retrieved successfully");
      } else {
        toast.info("No new users were created - they may already exist");
      }
    } catch (error) {
      console.error("Error calling setup function:", error);
      toast.error("Failed to retrieve credentials");
    } finally {
      setLoadingCredentials(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={getUserCredentials}
                    disabled={loadingCredentials}
                    className="w-full"
                  >
                    {loadingCredentials ? "Loading..." : "Get User Credentials"}
                  </Button>
                  
                  {userCredentials.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Generated User Credentials:</h4>
                      {userCredentials.map((cred, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{cred.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(`Email: ${cred.email}\nPassword: ${cred.password}`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>Email: {cred.email}</div>
                            <div>Password: {cred.password}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
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
                    No affiliates found.
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
        </main>
      </div>
    </div>
  );
}
