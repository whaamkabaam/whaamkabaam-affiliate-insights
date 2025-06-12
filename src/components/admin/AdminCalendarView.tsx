
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

// Helper function to format date in European format (DD/MM/YYYY)
const formatEuropeanDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Network Calendar
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Visual overview of commission events across your affiliate network
          </p>
        </div>
        <div className="w-64">
          <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
            <SelectTrigger className="border-primary/20 focus:border-primary">
              <Filter className="w-4 h-4 mr-2 text-primary" />
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Monthly Commission"
          value={`$${monthlyStats.totalCommission.toFixed(2)}`}
          description={selectedAffiliate === "all" ? "Across all affiliates" : `From ${selectedAffiliate}`}
          icon={<DollarSign className="w-5 h-5" />}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-lg transition-all duration-300"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${monthlyStats.totalRevenue.toFixed(2)}`}
          description="Total sales volume"
          icon={<TrendingUp className="w-5 h-5" />}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-lg transition-all duration-300"
        />
        <StatsCard
          title="Transactions"
          value={monthlyStats.totalTransactions}
          description="Total sales count"
          icon={<CalendarIcon className="w-5 h-5" />}
          className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 hover:shadow-lg transition-all duration-300"
        />
        <StatsCard
          title="Unique Customers"
          value={monthlyStats.uniqueCustomers}
          description="Individual buyers"
          icon={<Users className="w-5 h-5" />}
          className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 hover:shadow-lg transition-all duration-300"
        />
      </div>

      <CalendarHeader
        currentMonth={currentMonth}
        isLoading={isLoading}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-primary/20 shadow-xl bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border-b border-primary/10">
              <CardTitle className="flex items-center text-xl">
                <TrendingUp className="mr-3 h-6 w-6 text-primary" />
                Network Commission Events
                <Badge variant="secondary" className="ml-auto">
                  {Object.keys(datesWithEvents).length} active days
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-16">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-4 text-lg text-muted-foreground">Loading calendar data...</p>
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
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center justify-between">
                  <span>{formatEuropeanDate(selectedDate.toISOString())}</span>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {selectedDateEvents.length} events
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-background/60 rounded-lg border border-primary/20">
                      <div className="text-sm text-muted-foreground">Total Commission</div>
                      <div className="text-lg font-bold text-green-600">
                        +${selectedDateEvents.reduce((sum, e) => sum + e.commission, 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedDateEvents.map((commission, index) => (
                        <div key={index} className="p-4 bg-background/80 rounded-lg border border-primary/15 hover:border-primary/30 transition-all duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-semibold text-green-600">+${commission.commission.toFixed(2)}</span>
                            <Badge variant="secondary" className="text-xs font-mono">
                              {commission.affiliateCode}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
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
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>No transactions on this date</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Events Panel */}
          <Card className="shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {filteredCommissions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 15)
                  .map((commission, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-primary/20">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {censorEmail(commission.customerEmail)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatEuropeanDate(commission.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {commission.affiliateCode}
                      </Badge>
                      <div className="text-sm font-bold text-green-600">
                        +${commission.commission.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredCommissions.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>No commission data available for this period.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
