
import { useState, useEffect } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
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
          setChartData([
            { month: "Jan", commission: 0 },
            { month: "Feb", commission: 0 },
            { month: "Mar", commission: 0 },
            { month: "Apr", commission: 0 },
            { month: "May", commission: 0 }
          ]);
          setIsLoading(false);
        }
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      const currentYear = new Date().getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      try {
        // Fetch chart data directly from database without affecting global state
        const data = [];
        for (let month = 1; month <= 12; month++) {
          // Only include months up to current month
          if (month > new Date().getMonth() + 1 && currentYear === new Date().getFullYear()) {
            break;
          }
          
          // Calculate date range for this month
          const startDate = new Date(currentYear, month - 1, 1).toISOString();
          const endDate = new Date(currentYear, month, 0, 23, 59, 59).toISOString();
          
          // Query database directly for this affiliate's commission total for this month
          // Filter out hardcoded examples in the query
          const { data: monthlyData, error: queryError } = await supabase
            .from('promo_code_sales')
            .select('affiliate_commission, customer_email')
            .eq('promo_code_name', user.affiliateCode)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .not('customer_email', 'like', '%unknown@example.com%')
            .not('customer_email', 'like', '%example.com%')
            .neq('customer_email', 'unknown@example.com');
          
          if (queryError) {
            console.error(`Error fetching chart data for ${currentYear}-${month}:`, queryError);
            data.push({
              month: monthNames[month - 1],
              commission: 0,
            });
            continue;
          }
          
          // Calculate total commission for this month from real customers only
          const totalCommission = monthlyData?.reduce((sum, record) => {
            // Double check to filter out any remaining example data
            if (record.customer_email && 
                !record.customer_email.includes('unknown@example.com') &&
                !record.customer_email.includes('example.com') &&
                record.customer_email !== 'unknown@example.com') {
              return sum + (Number(record.affiliate_commission) || 0);
            }
            return sum;
          }, 0) || 0;
          
          if (isMounted) {
            data.push({
              month: monthNames[month - 1],
              commission: Number(totalCommission.toFixed(2)),
            });
          }
        }
        
        if (isMounted) {
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
          <CardTitle>Monthly Commission</CardTitle>
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
          <CardTitle>Monthly Commission</CardTitle>
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
          <CardTitle>Monthly Commission</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-muted-foreground text-center">
            <p>Aggregate commission data for all affiliates</p>
            <p className="mt-2">Visit specific affiliate accounts to view detailed charts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Monthly Commission</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`$${value}`, "Commission"]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="commission"
                stroke="#FF3F4E"
                activeDot={{ r: 8 }}
                name="Commission ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
