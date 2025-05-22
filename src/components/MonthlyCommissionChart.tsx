
import { useState, useEffect } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MonthlyCommissionChart() {
  const { getMonthlyStats } = useAffiliate();
  const [chartData, setChartData] = useState<{ month: string; commission: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
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
            commission: stats.totalCommission.toFixed(2),
          });
        } catch (error) {
          console.error(`Failed to fetch stats for ${currentYear}-${month}:`, error);
          data.push({
            month: monthNames[month - 1],
            commission: 0,
          });
        }
      }
      setChartData(data);
      setIsLoading(false);
    };

    fetchData();
  }, [getMonthlyStats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Commission</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-muted-foreground">Loading chart data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
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
