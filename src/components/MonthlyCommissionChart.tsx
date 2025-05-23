
import { useState, useEffect } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export function MonthlyCommissionChart() {
  const { getMonthlyStats, isAdmin } = useAffiliate();
  const [chartData, setChartData] = useState<{ month: string; commission: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsRefreshing(true);
      setError(null);
      
      // If admin, show placeholder or aggregate data
      if (isAdmin) {
        setChartData([
          { month: "Jan", commission: 0 },
          { month: "Feb", commission: 0 },
          { month: "Mar", commission: 0 },
          { month: "Apr", commission: 0 },
          { month: "May", commission: 0 }
        ]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      const currentYear = new Date().getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      const data = [];
      for (let month = 1; month <= 12; month++) {
        // Only include months up to current month
        if (month > new Date().getMonth() + 1 && currentYear === new Date().getFullYear()) {
          break;
        }
        
        try {
          const stats = await getMonthlyStats(currentYear, month);
          data.push({
            month: monthNames[month - 1],
            commission: Number(stats.totalCommission.toFixed(2)),
          });
        } catch (error) {
          console.error(`Failed to fetch stats for ${currentYear}-${month}:`, error);
          setError("Failed to fetch commission data. Please try again later.");
          data.push({
            month: monthNames[month - 1],
            commission: 0,
          });
        }
      }
      setChartData(data);
      setIsLoading(false);
      setIsRefreshing(false);
    };

    fetchData();
  }, [getMonthlyStats, isAdmin]);

  if (isLoading) {
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

  if (error) {
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
        {isRefreshing && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Updating...
          </div>
        )}
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
