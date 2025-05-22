
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
import { DollarSign, Users, TrendingUp, Calendar } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { fetchCommissionData, summary, isLoading } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchCommissionData(selectedYear, selectedMonth);
  }, [fetchCommissionData, selectedYear, selectedMonth]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
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
                  onClick={() => {
                    navigator.clipboard.writeText(`https://whaamkabaam.com/?ref=${user?.affiliateCode}`);
                    alert("Link copied to clipboard!");
                  }}
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
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
            <CommissionTable limit={5} />
          </div>
        </main>
      </div>
    </div>
  );
}
