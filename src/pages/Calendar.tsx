
import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Star, Sparkles } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { censorEmail } from "@/utils/emailUtils";
import { filterCommissions } from "@/utils/affiliateUtils";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const { user } = useAuth();
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
    const date = new Date(commission.date).toISOString().split('T')[0];
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

  // Generate calendar days using date-fns for better date handling
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay()); // Start from Sunday
    
    const calendarEnd = new Date(monthEnd);
    calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay())); // End on Saturday
    
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return calendarDays.map((day) => {
      const dateString = day.toISOString().split('T')[0];
      const dayEvents = datesWithEvents[dateString];
      const hasEvents = dayEvents && dayEvents.count > 0;
      const isCurrentMonth = isSameMonth(day, currentMonth);
      const isDayToday = isToday(day);
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isHovered = hoveredDate && isSameDay(day, hoveredDate);
      
      return (
        <div 
          key={day.toISOString()}
          className={cn(
            "relative h-28 border border-muted/30 p-2 cursor-pointer transition-all duration-200 group",
            "hover:border-primary/40 hover:shadow-md hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary/5",
            !isCurrentMonth && "bg-muted/20 opacity-50",
            isDayToday && "ring-2 ring-primary/50 bg-primary/5",
            isSelected && "bg-primary/10 border-primary/60 shadow-lg",
            isHovered && "bg-primary/5",
            hasEvents && "bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20"
          )}
          onClick={() => setSelectedDate(day)}
          onMouseEnter={() => setHoveredDate(day)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          <div className={cn(
            "font-medium text-sm mb-1 transition-colors",
            !isCurrentMonth && "text-muted-foreground",
            isDayToday && "text-primary font-bold",
            isSelected && "text-primary"
          )}>
            {format(day, 'd')}
          </div>
          
          {hasEvents && (
            <div className="space-y-1">
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-xs px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20",
                  "group-hover:bg-primary/20 transition-colors animate-pulse"
                )}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {dayEvents.count} sale{dayEvents.count > 1 ? 's' : ''}
              </Badge>
              
              <div className="text-xs space-y-0.5">
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <DollarSign className="w-3 h-3 mr-1" />
                  ${dayEvents.totalCommission.toFixed(2)}
                </div>
                <div className="text-muted-foreground">
                  ${dayEvents.totalAmount.toFixed(2)} total
                </div>
              </div>
              
              {(isHovered || isSelected) && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded pointer-events-none animate-fade-in" />
              )}
            </div>
          )}
          
          {isDayToday && (
            <div className="absolute top-1 right-1">
              <Star className="w-4 h-4 text-primary fill-primary/20" />
            </div>
          )}
        </div>
      );
    });
  };

  // Get events for selected date
  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    
    const dateString = selectedDate.toISOString().split('T')[0];
    return filteredCommissions.filter(commission => 
      commission.date.startsWith(dateString)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const selectedDateEvents = getSelectedDateEvents();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Commission Calendar
              </h1>
              <p className="text-muted-foreground mt-1">
                Track your sales and commissions over time
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={prevMonth} 
                disabled={isLoading}
                className="hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-2 rounded-lg border border-primary/20">
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={nextMonth} 
                disabled={isLoading}
                className="hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
                    <div className="calendar-container">
                      <div className="grid grid-cols-7 gap-px bg-muted/30">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="h-12 flex items-center justify-center font-medium bg-gradient-to-r from-primary/10 to-secondary/10 text-primary">
                            {day}
                          </div>
                        ))}
                        {generateCalendarDays()}
                      </div>
                    </div>
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
                            {selectedDateEvents.length} commission{selectedDateEvents.length > 1 ? 's' : ''}
                          </Badge>
                          <div className="text-sm font-medium text-primary">
                            ${selectedDateEvents.reduce((sum, e) => sum + e.commission, 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedDateEvents.map((commission, index) => (
                            <div key={index} className="p-3 bg-background/50 rounded-lg border border-primary/10">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">${commission.commission.toFixed(2)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(commission.date), "HH:mm")}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Sale: ${commission.amount.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {censorEmail(commission.customerEmail)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No commissions on this date</p>
                    )}
                  </CardContent>
                </Card>
              )}

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
                          <div key={index} className="flex items-center justify-between border-b pb-2 hover:bg-muted/20 -mx-2 px-2 py-2 rounded transition-colors">
                            <div>
                              <p className="font-medium">{format(new Date(commission.date), "MMM d")}</p>
                              <p className="text-sm text-muted-foreground">
                                +${commission.commission.toFixed(2)} from {censorEmail(commission.customerEmail)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-green-600">${commission.amount.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Total Sale</p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-muted-foreground">No commission events found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
