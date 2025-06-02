
import { useEffect, useState, useCallback } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommissionTable } from "@/components/CommissionTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { filterCommissions } from "@/utils/affiliateUtils";
import { AlertCircle, TrendingUp } from "lucide-react";

export default function Analytics() {
  const { user } = useAuth();
  const { fetchCommissionData, commissions } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const handleMonthChange = useCallback(async (year: number, month: number) => {
    console.log(`Analytics: Month changed to ${year}-${month}`);
    setIsLoading(true);
    setSelectedYear(year);
    setSelectedMonth(month);
    setHasFetched(false);
    
    if (user?.affiliateCode) {
      try {
        await fetchCommissionData(year, month, false);
        setHasFetched(true);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [user?.affiliateCode, fetchCommissionData]);

  // Initial data fetch
  useEffect(() => {
    if (user?.affiliateCode && !hasFetched) {
      console.log(`Analytics: Initial fetch for ${user.affiliateCode}`);
      handleMonthChange(selectedYear, selectedMonth);
    }
  }, [user?.affiliateCode, selectedYear, selectedMonth, hasFetched, handleMonthChange]);

  // Filter commissions to remove example data and validate real data
  const filteredCommissions = filterCommissions(commissions, user?.affiliateCode);

  // Strict validation for real data - check for actual commission amounts > 0
  const realCommissions = filteredCommissions.filter(commission => {
    const hasRealEmail = commission.customerEmail && 
                        !commission.customerEmail.includes('example.com') && 
                        !commission.customerEmail.includes('unknown@') &&
                        commission.customerEmail !== 'unknown@example.com';
    const hasRealCommission = commission.commission > 0;
    const hasValidDate = commission.date && new Date(commission.date).getFullYear() >= 2020;
    
    return hasRealEmail && hasRealCommission && hasValidDate;
  });

  // Check if we have any real data
  const hasRealData = realCommissions.length > 0;

  // Only calculate charts and product data if we have real data
  let productChartData: { name: string; value: number }[] = [];
  let dailyChartData: { day: string; amount: number }[] = [];

  if (hasRealData) {
    // Calculate product distribution based on actual commission amounts
    const productData = realCommissions.reduce((acc: Record<string, { name: string, value: number }>, commission) => {
      const productMap: Record<string, string> = {
        "prod_RINKAvP3L2kZeV": "Basic",
        "prod_RINJvQw1Qw1Qw1Q": "Premium", 
        "prod_RINO6yE0y4O9gX": "Enterprise",
      };
      
      const productName = productMap[commission.productId] || "Other";
      
      if (!acc[productName]) {
        acc[productName] = { name: productName, value: 0 };
      }
      
      acc[productName].value += commission.commission;
      return acc;
    }, {});

    productChartData = Object.values(productData);

    // Calculate daily commission distribution
    const dailyData = realCommissions.reduce((acc: Record<string, { day: string; amount: number }>, commission) => {
      const date = new Date(commission.date);
      const day = date.getDate().toString();
      
      if (!acc[day]) {
        acc[day] = { day, amount: 0 };
      }
      
      acc[day].amount += commission.commission;
      return acc;
    }, {});

    // Sort by day number
    dailyChartData = Object.values(dailyData).sort((a, b) => 
      parseInt(a.day) - parseInt(b.day)
    );
  }

  const COLORS = ['#FF3F4E', '#FFCC00', '#0088FE', '#00C49F'];

  // No Data State Component
  const NoDataState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">No Commission Data Available</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        You don't have any commission data yet. Start promoting with your affiliate code to see analytics here.
      </p>
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Your affiliate code: <span className="font-mono font-semibold">{user?.affiliateCode}</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground">
                Detailed view of your affiliate performance.
              </p>
            </div>
            <MonthPicker onMonthChange={handleMonthChange} isLoading={isLoading} />
          </div>

          {!hasRealData ? (
            <NoDataState />
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="products">Product Breakdown</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Commission</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {dailyChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={dailyChartData}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value) => {
                                if (typeof value === 'number') {
                                  return `$${value.toFixed(2)}`;
                                }
                                return `$${value}`;
                              }}
                              labelFormatter={(label) => `Day ${label}`}
                            />
                            <Legend />
                            <Bar dataKey="amount" fill="#FF3F4E" name="Commission ($)" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No daily commission data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Commission by Product</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {productChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={productChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {productChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => {
                                if (typeof value === 'number') {
                                  return `$${value.toFixed(2)}`;
                                }
                                return `$${value}`;
                              }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No product commission data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Product Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-8">
                      {productChartData.length > 0 ? (
                        productChartData.map((product, index) => (
                          <div key={product.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{product.name} Plan</div>
                              <div className="text-sm text-muted-foreground">${product.value.toFixed(2)} Commission</div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full" 
                                style={{ 
                                  width: `${(product.value / productChartData.reduce((sum, p) => sum + p.value, 0) * 100).toFixed(0)}%`,
                                  backgroundColor: COLORS[index % COLORS.length]
                                }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No product sales data available yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="transactions">
                <Card>
                  <CardHeader>
                    <CardTitle>All Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CommissionTable />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}
