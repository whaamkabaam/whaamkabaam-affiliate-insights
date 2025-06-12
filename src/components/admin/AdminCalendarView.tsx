
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, DollarSign, Calendar as CalendarIcon, Filter } from "lucide-react";
import { addMonths, subMonths, format } from "date-fns";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { filterCommissions } from "@/utils/affiliateUtils";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatsCard } from "@/components/StatsCard";
import { censorEmail } from "@/utils/emailUtils";

export const AdminCalendarView = () => {
  const { commissions, fetchCommissionData, affiliateOverviews } = useAffiliate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>("all");

  // Filter out admin from affiliate overviews
  const realAffiliates = affiliateOverviews.filter(affiliate => 
    affiliate.affiliateCode !== 'admin' && 
    affiliate.email !== 'admin@whaamkabaam.com'
  );

  // Fetch data for the current month when component mounts or month changes
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    console.log(`Admin Calendar: Fetching data for year: ${year}, month: ${month}`);
    setIsLoading(true);
    fetchCommissionData(year, month, true).finally(() => setIsLoading(false)); // Force refresh for admin
  }, [currentMonth, fetchCommissionData]);

  // Filter commissions based on selected affiliate
  const getFilteredCommissions = useCallback(() => {
    if (selectedAffiliate === "all") {
      return filterCommissions(commissions); // Remove only test data, keep all real affiliate data
    } else {
      return filterCommissions(commissions, selectedAffiliate);
    }
  }, [commissions, selectedAffiliate]);

  const filteredCommissions = getFilteredCommissions();
  
  console.log(`Admin Calendar: Total commissions: ${commissions.length}, Filtered: ${filteredCommissions.length}, Selected affiliate: ${selectedAffiliate}`);

  // Calculate summary stats for the filtered data
  const monthlyStats = {
    totalCommission: filteredCommissions.reduce((sum, c) => sum + c.commission, 0),
    totalRevenue: filteredCommissions.reduce((sum, c) => sum + c.amount, 0),
    totalTransactions: filteredCommissions.length,
    uniqueCustomers: new Set(filteredCommissions.map(c => c.customerEmail)).size
  };

  // Generate dates with events using filtered commissions
  const datesWithEvents = filteredCommissions.reduce((acc: Record<string, { count: number; totalAmount: number; totalCommission: number; affiliates: Set<string> }>, commission) => {
    const date = commission.date.split('T')[0];
    if (!acc[date]) {
      acc[date] = { count: 0, totalAmount: 0, totalCommission: 0, affiliates: new Set() };
    }
    acc[date].count += 1;
    acc[date].totalAmount += commission.amount;
    acc[date].totalCommission += commission.commission;
    if (commission.affiliateCode) {
      acc[date].affiliates.add(commission.affiliateCode);
    }
    return acc;
  }, {});

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  // Get events for selected date with censored data for all users
  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return filteredCommissions.filter(commission => 
      commission.date.startsWith(dateString)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const selectedDateEvents = getSelectedDateEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Network Calendar</h1>
          <p className="text-muted-foreground">
            Visual overview of commission events across your affiliate network
          </p>
        </div>
        <div className="w-64">
          <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by affiliate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Affiliates</SelectItem>
              {realAffiliates.map((affiliate) => (
                <SelectItem key={affiliate.affiliateCode} value={affiliate.affiliateCode}>
                  {affiliate.affiliateCode} ({affiliate.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Monthly Commission"
          value={`$${monthlyStats.totalCommission.toFixed(2)}`}
          description={selectedAffiliate === "all" ? "Across all affiliates" : `From ${selectedAffiliate}`}
          icon={<DollarSign className="w-4 h-4" />}
          className="bg-green-50 border-green-200"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${monthlyStats.totalRevenue.toFixed(2)}`}
          description="Total sales volume"
          icon={<TrendingUp className="w-4 h-4" />}
          className="bg-blue-50 border-blue-200"
        />
        <StatsCard
          title="Transactions"
          value={monthlyStats.totalTransactions}
          description="Total sales count"
          icon={<CalendarIcon className="w-4 h-4" />}
          className="bg-purple-50 border-purple-200"
        />
        <StatsCard
          title="Unique Customers"
          value={monthlyStats.uniqueCustomers}
          description="Individual buyers"
          icon={<Users className="w-4 h-4" />}
          className="bg-orange-50 border-orange-200"
        />
      </div>

      <CalendarHeader
        currentMonth={currentMonth}
        isLoading={isLoading}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-primary/10">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                Network Commission Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading calendar data...</p>
                </div>
              ) : (
                <CalendarGrid
                  currentMonth={currentMonth}
                  selectedDate={selectedDate}
                  hoveredDate={hoveredDate}
                  datesWithEvents={datesWithEvents}
                  onDateSelect={setSelectedDate}
                  onDateHover={setHoveredDate}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {selectedDate && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-primary/30">
                        {selectedDateEvents.length} transaction{selectedDateEvents.length > 1 ? 's' : ''}
                      </Badge>
                      <div className="text-sm font-medium text-primary">
                        +${selectedDateEvents.reduce((sum, e) => sum + e.commission, 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDateEvents.map((commission, index) => (
                        <div key={index} className="p-3 bg-background/50 rounded-lg border border-primary/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">+${commission.commission.toFixed(2)}</span>
                            <Badge variant="secondary" className="text-xs">
                              {commission.affiliateCode}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {censorEmail(commission.customerEmail)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(commission.date), "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No transactions on this date</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Events Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredCommissions.slice(0, 10).map((commission, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {censorEmail(commission.customerEmail)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(commission.date), "MMM d, HH:mm")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {commission.affiliateCode}
                      </Badge>
                      <div className="text-sm font-semibold text-green-600">
                        +${commission.commission.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredCommissions.length === 0 && !isLoading && (
                <div className="text-center py-4 text-muted-foreground">
                  No commission data available for this period.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
