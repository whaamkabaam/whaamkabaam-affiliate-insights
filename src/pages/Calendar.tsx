
import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { censorEmail } from "@/utils/emailUtils";
import { filterCommissions } from "@/utils/affiliateUtils";

export default function Calendar() {
  const { user } = useAuth();
  const { commissions, fetchCommissionData } = useAffiliate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

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

  // Filter commissions to remove example data
  const filteredCommissions = filterCommissions(commissions, user?.affiliateCode);

  // Generate dates with events using filtered commissions
  const datesWithEvents = filteredCommissions.reduce((acc: Record<string, number>, commission) => {
    const date = new Date(commission.date).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
    setHasFetched(false); // Reset to allow fetching for new month
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
    setHasFetched(false); // Reset to allow fetching for new month
  }, []);

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Generate array of days
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-muted bg-muted/20"></div>);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const hasEvents = datesWithEvents[dateString] > 0;
      const eventCount = datesWithEvents[dateString] || 0;
      
      days.push(
        <div 
          key={day} 
          className={`h-24 border border-muted p-2 relative ${hasEvents ? 'bg-primary/5' : ''}`}
        >
          <div className="font-medium">{day}</div>
          {hasEvents && (
            <div className="absolute bottom-2 right-2">
              <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {eventCount}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={prevMonth} disabled={isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>{format(currentMonth, "MMMM yyyy")}</span>
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth} disabled={isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Events</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading calendar data...</p>
                </div>
              ) : (
                <div className="calendar-container">
                  <div className="grid grid-cols-7 gap-px">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="h-10 flex items-center justify-center font-medium">
                        {day}
                      </div>
                    ))}
                    {generateCalendarDays()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredCommissions.length > 0 ? (
                  filteredCommissions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((commission, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="font-medium">{format(new Date(commission.date), "MMMM d, yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${commission.commission.toFixed(2)} from {censorEmail(commission.customerEmail)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${commission.amount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Total Sale</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground">No commission events this month</p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
