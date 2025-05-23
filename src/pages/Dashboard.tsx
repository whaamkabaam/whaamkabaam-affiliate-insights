
import { useEffect, useState } from "react";
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
  const { user, isAdmin } = useAuth();
  const { fetchCommissionData, summary, isLoading, error } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dataRefreshing, setDataRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If the user is an admin, redirect them to the admin dashboard
    if (isAdmin) {
      navigate("/admin");
      return;
    }

    // Only fetch data if we're not already loading
    if (!isLoading) {
      setDataRefreshing(true);
      fetchCommissionData(selectedYear, selectedMonth)
        .finally(() => {
          setDataRefreshing(false);
        });
    }
  }, [fetchCommissionData, selectedYear, selectedMonth, isAdmin, navigate, isLoading]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const handleCopyLink = () => {
    if (user?.affiliateCode) {
      const url = `https://whaamkabaam.com/?ref=${user.affiliateCode}`;
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Affiliate link copied to clipboard"))
        .catch(() => toast.error("Failed to copy link"));
    }
  };

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
            <MonthPicker onMonthChange={handleMonthChange} />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">Loading your commission data...</span>
            </div>
          ) : (
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
                  value={user?.affiliateCode || ""}
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
                    >
                      Copy
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-3 rounded-md overflow-x-auto">
                      <code className="text-sm">https://whaamkabaam.com/?ref={user?.affiliateCode}</code>
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
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
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
          )}
        </main>
      </div>
    </div>
  );
}
