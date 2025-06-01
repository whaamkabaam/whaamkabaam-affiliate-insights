
import { useEffect, useState, useCallback } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { StatsCard } from "@/components/StatsCard";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthlyCommissionChart } from "@/components/MonthlyCommissionChart";
import { CommissionTable } from "@/components/CommissionTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/MonthPicker";
import { DollarSign, Users, TrendingUp, Calendar, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, isAdmin, isLoading: authIsLoading } = useAuth();
  const { fetchCommissionData, summary, isLoading: affiliateIsLoading, error } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dataRefreshing, setDataRefreshing] = useState(false);
  const [initialDataFetched, setInitialDataFetched] = useState(false);
  const navigate = useNavigate();

  // Debug logging to track loading states
  console.log("Dashboard render - Auth loading:", authIsLoading, "User:", user?.email, "Is admin:", isAdmin);
  console.log("Dashboard render - Affiliate loading:", affiliateIsLoading, "Has summary:", !!summary, "Error:", error);
  console.log("Dashboard render - User affiliate code:", user?.affiliateCode);

  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (!authIsLoading && isAdmin) {
      console.log("User is admin, redirecting to /admin");
      navigate("/admin");
    }
  }, [authIsLoading, isAdmin, navigate]);

  // Memoized month change handler to prevent unnecessary re-renders
  const handleMonthChange = useCallback((year: number, month: number) => {
    console.log("Month changed to:", year, month);
    // Only update if actually different
    if (year !== selectedYear || month !== selectedMonth) {
      setSelectedYear(year);
      setSelectedMonth(month);
      setInitialDataFetched(false); // Reset to allow new fetch
    }
  }, [selectedYear, selectedMonth]);

  // Single effect for data fetching with proper dependencies
  useEffect(() => {
    // Wait for authentication to complete
    if (authIsLoading) {
      console.log("Auth still loading, waiting...");
      return;
    }

    // Skip if user is admin (they'll be redirected)
    if (isAdmin) {
      return;
    }

    // Only proceed if we have a user with an affiliate code and haven't fetched initial data
    if (user?.affiliateCode && !affiliateIsLoading && !initialDataFetched) {
      console.log("Fetching commission data for affiliate:", user.affiliateCode, "Year:", selectedYear, "Month:", selectedMonth);
      setInitialDataFetched(true);
      
      fetchCommissionData(selectedYear, selectedMonth, false)
        .then(() => {
          console.log("Commission data fetch completed successfully");
        })
        .catch((err) => {
          console.error("Commission data fetch failed:", err);
          setInitialDataFetched(false); // Allow retry on error
        });
    } else if (user && !user.affiliateCode) {
      console.log("User has no affiliate code:", user.email);
    }
  }, [user?.affiliateCode, selectedYear, selectedMonth, authIsLoading, isAdmin, affiliateIsLoading, fetchCommissionData, initialDataFetched]);

  // Handle error display
  useEffect(() => {
    if (error) {
      console.error("Affiliate context error:", error);
      toast.error(error);
    }
  }, [error]);

  const handleCopyLink = () => {
    if (user?.affiliateCode) {
      const url = `https://whaamkabaam.com/?ref=${user.affiliateCode}`;
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Affiliate link copied to clipboard"))
        .catch(() => toast.error("Failed to copy link"));
    }
  };

  const handleRefresh = async () => {
    if (!dataRefreshing && user?.affiliateCode) {
      setDataRefreshing(true);
      console.log("Force refreshing data from Stripe...");
      
      try {
        await fetchCommissionData(selectedYear, selectedMonth, true);
        toast.success("Data refreshed from Stripe");
      } catch (error) {
        console.error("Refresh error:", error);
        toast.error("Failed to refresh data");
      } finally {
        setDataRefreshing(false);
      }
    }
  };

  const renderDashboardContent = () => {
    console.log("Rendering dashboard content - conditions check:");
    console.log("- authIsLoading:", authIsLoading);
    console.log("- user exists:", !!user);
    console.log("- user.affiliateCode:", user?.affiliateCode);
    console.log("- isAdmin:", isAdmin);
    console.log("- affiliateIsLoading:", affiliateIsLoading);

    if (authIsLoading) {
      console.log("Showing auth loading screen");
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading user data...</span>
        </div>
      );
    }

    if (user && !user.affiliateCode && !isAdmin) {
      console.log("Showing no affiliate code warning");
      return (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <p className="text-sm text-orange-600">
                Affiliate code not found for your account. Dashboard data cannot be loaded. Please contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    if (affiliateIsLoading && !summary) {
      console.log("Showing affiliate data loading screen");
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading your commission data...</span>
        </div>
      );
    }

    if (!user?.affiliateCode && !isAdmin) {
      console.log("No user or affiliate code, returning null");
      return null;
    }

    console.log("Rendering full dashboard content");
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Commission"
            value={`$${summary.totalCommission.toFixed(2)}`}
            description={`For ${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`}
            icon={<DollarSign className="w-4 h-4" />}
            className="bg-primary/5"
          />
          <StatsCard
            title="Total Revenue"
            value={`$${summary.totalRevenue.toFixed(2)}`}
            description="Generated through your affiliate link"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatsCard
            title="New Customers"
            value={summary.customerCount}
            description="People who used your affiliate code"
            icon={<Users className="w-4 h-4" />}
          />
          <StatsCard
            title="Your Code"
            value={user?.affiliateCode || "N/A"}
            description="Share this code with your audience"
            icon={<Calendar className="w-4 h-4" />}
            className="bg-secondary/10"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="md:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle>Your Affiliate Link</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCopyLink}
                disabled={!user?.affiliateCode}
              >
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md overflow-x-auto">
                <code className="text-sm">
                  {user?.affiliateCode 
                    ? `https://whaamkabaam.com/?ref=${user.affiliateCode}`
                    : "No affiliate code available."}
                </code>
              </div>
            </CardContent>
          </Card>
          
          <MonthlyCommissionChart />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold tracking-tight">Recent Transactions</h2>
            {dataRefreshing && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing data...
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={dataRefreshing || !user?.affiliateCode}>
                {dataRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" size="sm" disabled={!user?.affiliateCode}>
                View All
              </Button>
            </div>
          </div>
          <CommissionTable limit={5} />
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  console.log("About to render dashboard layout");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user?.name || 'Affiliate'}</h1>
              <p className="text-muted-foreground">
                Here's what's happening with your affiliate account today.
              </p>
            </div>
            <MonthPicker 
              onMonthChange={handleMonthChange}
              defaultYear={selectedYear}
              defaultMonth={selectedMonth}
            />
          </div>

          {renderDashboardContent()}
        </main>
      </div>
    </div>
  );
}
