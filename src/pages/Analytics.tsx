import { useEffect, useState, useCallback } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommissionTable } from "@/components/CommissionTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { filterCommissions } from "@/utils/affiliateUtils";
import { getProductName } from "@/utils/productUtils";
import { AlertCircle, TrendingUp, DollarSign, Package, Target, Users, BarChart3, Calendar } from "lucide-react";

export default function Analytics() {
  const { user } = useAuth();
  const { fetchCommissionData, commissions } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

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

  // Enhanced product data calculation with monthly averages
  let productChartData: { 
    name: string; 
    value: number; 
    count: number; 
    avgSalesPerMonth: number;
    avgCommissionPerMonth: number;
    totalRevenue: number;
  }[] = [];
  let totalCommission = 0;
  let totalRevenue = 0;

  if (hasRealData) {
    // Calculate product distribution based on actual commission amounts
    const productData = realCommissions.reduce((acc: Record<string, { 
      name: string, 
      value: number, 
      count: number,
      totalRevenue: number,
      monthsActive: Set<string>
    }>, commission) => {
      const productName = getProductName(commission.productId);
      const commissionDate = new Date(commission.date);
      const monthKey = `${commissionDate.getFullYear()}-${commissionDate.getMonth()}`;
      
      if (!acc[productName]) {
        acc[productName] = { 
          name: productName, 
          value: 0, 
          count: 0, 
          totalRevenue: 0,
          monthsActive: new Set()
        };
      }
      
      acc[productName].value += commission.commission;
      acc[productName].count += 1;
      acc[productName].totalRevenue += commission.amount;
      acc[productName].monthsActive.add(monthKey);
      return acc;
    }, {});

    // Sort by commission value descending - THIS IS THE KEY FIX
    productChartData = Object.values(productData)
      .map(product => ({
        name: product.name,
        value: product.value,
        count: product.count,
        totalRevenue: product.totalRevenue,
        avgSalesPerMonth: product.count / Math.max(product.monthsActive.size, 1),
        avgCommissionPerMonth: product.value / Math.max(product.monthsActive.size, 1)
      }))
      .sort((a, b) => b.value - a.value); // Sort here so both chart and cards use same order
    
    totalCommission = productChartData.reduce((sum, product) => sum + product.value, 0);
    totalRevenue = productChartData.reduce((sum, product) => sum + product.totalRevenue, 0);
  }

  const COLORS = ['#FF3F4E', '#FFCC00', '#0088FE', '#00C49F', '#8884d8', '#FF8042'];

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

  // Fixed Custom Tooltip for Pie Chart with better positioning
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / totalCommission) * 100).toFixed(1);
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-xl z-50 max-w-xs">
          <p className="font-semibold text-foreground mb-2">{data.name}</p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Commission: <span className="font-semibold text-green-500">${data.value.toFixed(2)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Sales: <span className="font-semibold text-blue-500">{data.count}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Share: <span className="font-semibold text-purple-500">{percentage}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Enhanced Product Insights Card with valuable monthly metrics
  const ProductInsightCard = ({ product, index, total }: { product: any, index: number, total: number }) => {
    const percentage = ((product.value / total) * 100);
    const isHovered = hoveredProduct === product.name;
    
    return (
      <div 
        className={`group p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
          isHovered 
            ? 'border-primary shadow-lg shadow-primary/20 bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:shadow-md'
        }`}
        onMouseEnter={() => setHoveredProduct(product.name)}
        onMouseLeave={() => setHoveredProduct(null)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full shadow-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </div>
          <Package className={`w-5 h-5 transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Total Commission</span>
              </div>
              <span className="font-bold text-lg text-green-500">${product.value.toFixed(2)}</span>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Sales Count</span>
              </div>
              <span className="font-semibold text-blue-500">{product.count}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Avg Sales/Month</span>
              </div>
              <span className="font-semibold text-orange-500">{product.avgSalesPerMonth.toFixed(1)}</span>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Avg Commission/Month</span>
              </div>
              <span className="font-semibold text-purple-500">${product.avgCommissionPerMonth.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Revenue Share</span>
            <span className="text-xs font-medium">{percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${percentage}%`,
                backgroundColor: COLORS[index % COLORS.length]
              }}
            />
          </div>
        </div>
      </div>
    );
  };

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
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Product Analytics
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Transactions
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* Enhanced Product Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Interactive Pie Chart */}
                  <Card className="lg:col-span-1 bg-gradient-to-br from-card to-card/50 border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Commission Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {productChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={productChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={30}
                              fill="#8884d8"
                              dataKey="value"
                              stroke="none"
                              onMouseEnter={(data) => {
                                setHoveredProduct(data.name);
                              }}
                              onMouseLeave={() => setHoveredProduct(null)}
                            >
                              {productChartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]}
                                  stroke={hoveredProduct === entry.name ? '#ffffff' : 'none'}
                                  strokeWidth={hoveredProduct === entry.name ? 3 : 0}
                                  style={{
                                    filter: hoveredProduct === entry.name ? 'brightness(1.2) drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none',
                                    transition: 'all 0.3s ease'
                                  }}
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              content={<CustomTooltip />} 
                              offset={20}
                              position={{ x: 0, y: 0 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No product commission data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Product Insights Cards */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-semibold">Product Insights</h2>
                    </div>
                    
                    {productChartData.length > 0 ? (
                      <div className="grid gap-4">
                        {productChartData.map((product, index) => (
                          <ProductInsightCard 
                            key={product.name}
                            product={product}
                            index={index}
                            total={totalCommission}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No product sales data available yet.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="transactions">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      All Transactions
                    </CardTitle>
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
