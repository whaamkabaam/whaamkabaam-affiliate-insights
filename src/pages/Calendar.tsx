import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { addMonths, subMonths, format } from "date-fns";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { filterCommissions } from "@/utils/affiliateUtils";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { SelectedDatePanel } from "@/components/calendar/SelectedDatePanel";
import { RecentEventsPanel } from "@/components/calendar/RecentEventsPanel";
import { AdminCalendarView } from "@/components/admin/AdminCalendarView";

export default function Calendar() {
  const { user, isAdmin } = useAuth();
  const { commissions, fetchCommissionData } = useAffiliate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Fetch data for the current month when component mounts or month changes
  useEffect(() => {
    if (user?.affiliateCode && !hasFetched) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      console.log(`Calendar: Fetching data for ${user.affiliateCode}, year: ${year}, month: ${month}`);
      setIsLoading(true);
      setHasFetched(true);
      fetchCommissionData(year, month, false).finally(() => setIsLoading(false));
    }
  }, [user?.affiliateCode, currentMonth, hasFetched, fetchCommissionData]);

  // Filter commissions to remove example data and apply affiliate-specific filtering
  const filteredCommissions = filterCommissions(commissions, user?.affiliateCode);
  
  console.log(`Calendar: Total commissions: ${commissions.length}, Filtered: ${filteredCommissions.length}, User: ${user?.affiliateCode}`);

  // Generate dates with events using filtered commissions
  const datesWithEvents = filteredCommissions.reduce((acc: Record<string, { count: number; totalAmount: number; totalCommission: number }>, commission) => {
    const date = commission.date.split('T')[0];
    if (!acc[date]) {
      acc[date] = { count: 0, totalAmount: 0, totalCommission: 0 };
    }
    acc[date].count += 1;
    acc[date].totalAmount += commission.amount;
    acc[date].totalCommission += commission.commission;
    return acc;
  }, {});

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setHasFetched(false);
    setSelectedDate(null);
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setHasFetched(false);
    setSelectedDate(null);
  }, []);

  // Get events for selected date - FIX: Use proper date comparison
  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return filteredCommissions.filter(commission => 
      commission.date.startsWith(dateString)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const selectedDateEvents = getSelectedDateEvents();

  // If admin, show the enhanced admin calendar view
  if (isAdmin) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-6">
            <AdminCalendarView />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
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
                    Commission Events
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
                <SelectedDatePanel
                  selectedDate={selectedDate}
                  selectedDateEvents={selectedDateEvents}
                />
              )}

              <RecentEventsPanel commissions={filteredCommissions} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
