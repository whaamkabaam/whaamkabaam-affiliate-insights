
import { useEffect, useState } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommissionTable } from "@/components/CommissionTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Analytics() {
  const { fetchCommissionData, commissions } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchCommissionData(selectedYear, selectedMonth);
  }, [fetchCommissionData, selectedYear, selectedMonth]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  // Calculate product distribution
  const productData = commissions.reduce((acc: Record<string, { name: string, value: number }>, commission) => {
    const productMap: Record<string, string> = {
      "prod_RINKAvP3L2kZeV": "Basic",
      "prod_RINJvQw1Qw1Qw1Q": "Premium",
      "prod_RINO6yE0y4O9gX": "Enterprise",
    };
    
    const productName = productMap[commission.productId] || "Other";
    
    if (!acc[productName]) {
      acc[productName] = { name: productName, value: 0 };
    }
    
    acc[productName].value += commission.amount;
    return acc;
  }, {});

  const productChartData = Object.values(productData);
  const COLORS = ['#FF3F4E', '#FFCC00', '#0088FE', '#00C49F'];

  // Calculate daily distribution
  const dailyData = commissions.reduce((acc: Record<string, { day: string; amount: number }>, commission) => {
    const date = new Date(commission.date);
    const day = date.getDate().toString();
    
    if (!acc[day]) {
      acc[day] = { day, amount: 0 };
    }
    
    acc[day].amount += commission.commission;
    return acc;
  }, {});

  // Sort by day number
  const dailyChartData = Object.values(dailyData).sort((a, b) => 
    parseInt(a.day) - parseInt(b.day)
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
            <MonthPicker onMonthChange={handleMonthChange} />
          </div>

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
                          formatter={(value) => [`$${value}`, "Commission"]}
                          labelFormatter={(label) => `Day ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="amount" fill="#FF3F4E" name="Commission ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Product Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
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
                          formatter={(value) => [`$${value.toFixed(2)}`, "Revenue"]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
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
                    {productChartData.map((product, index) => (
                      <div key={product.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{product.name} Plan</div>
                          <div className="text-sm text-muted-foreground">${product.value.toFixed(2)} Revenue</div>
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
                    ))}
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
        </main>
      </div>
    </div>
  );
}
