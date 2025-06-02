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
import { DollarSign, Users, TrendingUp, Calendar, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
export default function Dashboard() {
  const {
    user,
    isAdmin,
    isLoading: authIsLoading
  } = useAuth();
  const {
    fetchCommissionData,
    summary,
    isLoading: affiliateIsLoading,
    error
  } = useAffiliate();
  // Default to "all time" view (year 0, month 0)
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [dataRefreshing, setDataRefreshing] = useState(false);
  const [monthSwitching, setMonthSwitching] = useState(false);
  const [initialDataFetched, setInitialDataFetched] = useState(false);
  const navigate = useNavigate();

  // Debug logging to track loading states
  console.log("Dashboard render - Auth loading:", authIsLoading, "User:", user?.email, "Is admin:", isAdmin);
  console.log("Dashboard render - Affiliate loading:", affiliateIsLoading, "Has summary:", !!summary, "Error:", error);
  console.log("Dashboard render - User affiliate code:", user?.affiliateCode);
  console.log("Dashboard render - Selected period:", selectedYear, selectedMonth);

  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (!authIsLoading && isAdmin) {
      console.log("User is admin, redirecting to /admin");
      navigate("/admin");
    }
  }, [authIsLoading, isAdmin, navigate]);

  // Memoized month change handler to prevent unnecessary re-renders
  const handleMonthChange = useCallback(async (year: number, month: number) => {
    console.log("Month changed to:", year, month);
    // Only update if actually different
    if (year !== selectedYear || month !== selectedMonth) {
      setMonthSwitching(true);
      setSelectedYear(year);
      setSelectedMonth(month);

      // Fetch new data for the selected period
      if (user?.affiliateCode && !isAdmin) {
        try {
          await fetchCommissionData(year, month, false);
        } catch (error) {
          console.error("Error fetching data for new period:", error);
        } finally {
          setMonthSwitching(false);
        }
      } else {
        setMonthSwitching(false);
      }
    }
  }, [selectedYear, selectedMonth, user?.affiliateCode, isAdmin, fetchCommissionData]);

  // Single effect for initial data fetching
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
      console.log("Fetching initial commission data for affiliate:", user.affiliateCode, "Year:", selectedYear, "Month:", selectedMonth);
      setInitialDataFetched(true);
      fetchCommissionData(selectedYear, selectedMonth, false).then(() => {
        console.log("Initial commission data fetch completed successfully");
      }).catch(err => {
        console.error("Initial commission data fetch failed:", err);
        setInitialDataFetched(false); // Allow retry on error
      });
    } else if (user && !user.affiliateCode) {
      console.log("User has no affiliate code:", user.email);
    }
  }, [user?.affiliateCode, authIsLoading, isAdmin, affiliateIsLoading, fetchCommissionData, initialDataFetched, selectedYear, selectedMonth]);

  // Handle error display
  useEffect(() => {
    if (error) {
      console.error("Affiliate context error:", error);
      toast.error(error);
    }
  }, [error]);
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
  const getDateRangeDescription = () => {
    if (selectedYear === 0 && selectedMonth === 0) {
      return "All time overview";
    }
    return new Date(selectedYear, selectedMonth - 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });
  };
  const getViewTypeIndicator = () => {
    if (selectedYear === 0 && selectedMonth === 0) {
      return <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/10 px-3 py-1 rounded-full">
          <Clock className="w-4 h-4" />
          All Time View
        </div>;
    }
    return <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-500/10 px-3 py-1 rounded-full">
        <Calendar className="w-4 h-4" />
        Monthly View
      </div>;
  };
  const getAyoubStartDateInfo = () => {
    if (user?.affiliateCode === "ayoub") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-500/10 px-3 py-1 rounded-full">
          <TrendingUp className="w-4 h-4" />
          Affiliate since May 20, 2025
        </div>
      );
    }
    return null;
  };
  const isDataLoading = affiliateIsLoading || monthSwitching;
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

    if (affiliateIsLoading && !summary && !initialDataFetched) {
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Total Commission"
            value={isDataLoading ? "Loading..." : `$${summary.totalCommission.toFixed(2)}`}
            description={getDateRangeDescription()}
            icon={isDataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            className="bg-primary/5"
            isLoading={isDataLoading}
          />
          <StatsCard
            title="New Customers"
            value={isDataLoading ? "Loading..." : summary.customerCount}
            description="People who used your affiliate code"
            icon={isDataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            isLoading={isDataLoading}
          />
          <StatsCard
            title="Your Code"
            value={user?.affiliateCode || "N/A"}
            description="Share this code with your audience"
            className="bg-secondary/10"
            showCopyButton={true}
          />
        </div>

        <div className="grid gap-4">
          <MonthlyCommissionChart />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold tracking-tight">Recent Transactions</h2>
            {(dataRefreshing || monthSwitching) && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {monthSwitching ? 'Loading period data...' : 'Refreshing data...'}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={dataRefreshing || monthSwitching || !user?.affiliateCode}
              >
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
  return <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user?.name || 'Affiliate'}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-muted-foreground">
                    Here's what's happening with your affiliate account today.
                  </p>
                  {getViewTypeIndicator()}
                  {getAyoubStartDateInfo()}
                </div>
              </div>
            </div>
            <MonthPicker onMonthChange={handleMonthChange} isLoading={monthSwitching} />
          </div>

          {renderDashboardContent()}
        </main>
      </div>
    </div>;
}
