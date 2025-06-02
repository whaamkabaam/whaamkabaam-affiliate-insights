import { useState, useEffect } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function MonthlyCommissionChart() {
  const { isAdmin } = useAffiliate();
  const { user } = useAuth();
  const [chartData, setChartData] = useState<{ month: string; commission: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchChartData = async () => {
      if (!user?.affiliateCode || isAdmin) {
        if (isMounted) {
          setChartData([]);
          setIsLoading(false);
        }
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 1-based month
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      try {
        const data = [];
        // Include ALL months from January up to current month
        for (let month = 1; month <= currentMonth; month++) {
          // Calculate proper date range for the ENTIRE month
          const startDate = new Date(currentYear, month - 1, 1, 0, 0, 0, 0).toISOString();
          
          // FIXED: For current month, use current time as end date to capture latest sales
          let endDate;
          if (month === currentMonth) {
            endDate = new Date().toISOString(); // Current time for current month
          } else {
            endDate = new Date(currentYear, month, 0, 23, 59, 59, 999).toISOString(); // Last day of month
          }
          
          // Determine the effective start date for filtering commissions
          let effectiveFilterStartDate = startDate;
          
          // For Ayoub, ensure commissions are not counted before May 20, 2025
          if (user.affiliateCode === 'ayoub') {
            const ayoubSpecificMinStartDate = new Date(2025, 4, 20, 0, 0, 0, 0).toISOString(); // May 20, 2025
            // Use the later of the two dates: the start of the month we are processing, or Ayoub's specific minimum start date
            effectiveFilterStartDate = (new Date(startDate) > new Date(ayoubSpecificMinStartDate)) ? startDate : ayoubSpecificMinStartDate;
          }
          
          console.log(`Chart: Querying month ${month}, start: ${effectiveFilterStartDate}, end: ${endDate}, affiliate: ${user.affiliateCode}`);
          
          // Query database directly for this affiliate's commission total for this month
          // Filter out hardcoded examples and $0 commissions
          const { data: monthlyData, error: queryError } = await supabase
            .from('promo_code_sales')
            .select('affiliate_commission, customer_email, created_at')
            .eq('promo_code_name', user.affiliateCode)
            .gte('created_at', effectiveFilterStartDate)
            .lte('created_at', endDate)
            .not('customer_email', 'like', '%unknown@example.com%')
            .not('customer_email', 'like', '%example.com%')
            .neq('customer_email', 'unknown@example.com')
            .gt('affiliate_commission', 0); // Only include positive commissions
          
          if (queryError) {
            console.error(`Error fetching chart data for ${currentYear}-${month}:`, queryError);
            data.push({
              month: monthNames[month - 1],
              commission: 0,
            });
            continue;
          }
          
          console.log(`Chart: Found ${monthlyData?.length || 0} records for month ${month}`);
          
          // Calculate total commission for this month from real customers only
          const totalCommission = monthlyData?.reduce((sum, record) => {
            // Double check to filter out any remaining example data
            if (record.customer_email && 
                !record.customer_email.includes('unknown@example.com') &&
                !record.customer_email.includes('example.com') &&
                record.customer_email !== 'unknown@example.com' &&
                record.affiliate_commission > 0) {
              console.log(`Chart: Including commission $${record.affiliate_commission} from ${record.customer_email} on ${record.created_at}`);
              return sum + (Number(record.affiliate_commission) || 0);
            }
            return sum;
          }, 0) || 0;
          
          console.log(`Chart: Total commission for month ${month}: $${totalCommission}`);
          
          if (isMounted) {
            data.push({
              month: monthNames[month - 1],
              commission: Number(totalCommission.toFixed(2)),
            });
          }
        }
        
        if (isMounted) {
          console.log('Chart: Final data:', data);
          setChartData(data);
          setIsLoading(false);
        }
        
      } catch (error) {
        console.error("Exception during chart data fetch:", error);
        if (isMounted) {
          setError("Failed to fetch chart data. Please try again later.");
          setIsLoading(false);
        }
      }
    };

    fetchChartData();

    return () => {
      isMounted = false;
    };
  }, [user?.affiliateCode, isAdmin]);

  if (isLoading && !chartData.length) {
    return (
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Commission
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="flex items-center flex-col gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !chartData.length) {
    return (
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Commission
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-red-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // For admin, show placeholder text instead of chart
  if (isAdmin) {
    return (
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Commission
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-muted-foreground text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Aggregate commission data for all affiliates</p>
            <p className="mt-2">Visit specific affiliate accounts to view detailed charts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{`${label} 2025`}</p>
          <p className="text-primary font-semibold">
            {`Commission: $${payload[0].value}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="lg:col-span-4 bg-gradient-to-br from-card to-card/50 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <TrendingUp className="w-5 h-5 text-primary" />
          Monthly Commission
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          2025 Performance
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF3F4E" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FF3F4E" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3}
              />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="commission"
                stroke="#FF3F4E"
                strokeWidth={3}
                fill="url(#commissionGradient)"
                dot={{ fill: "#FF3F4E", strokeWidth: 2, r: 4 }}
                activeDot={{ 
                  r: 6, 
                  fill: "#FF3F4E", 
                  stroke: "#ffffff", 
                  strokeWidth: 2,
                  filter: "drop-shadow(0 0 8px rgba(255, 63, 78, 0.4))"
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
