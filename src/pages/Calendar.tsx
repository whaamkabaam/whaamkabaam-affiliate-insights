import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { useAffiliate } from "@/contexts/AffiliateContext";

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { commissions } = useAffiliate();

  // Generate dates with events
  const datesWithEvents = commissions.reduce((acc: Record<string, number>, commission) => {
    const date = new Date(commission.date).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

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
      
      days.push(
        <div 
          key={day} 
          className={`h-24 border border-muted p-2 relative ${hasEvents ? 'bg-primary/5' : ''}`}
        >
          <div className="font-medium">{day}</div>
          {hasEvents && (
            <div className="absolute bottom-2 right-2">
              <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {datesWithEvents[dateString]}
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
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>{format(currentMonth, "MMMM yyyy")}</span>
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Events</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {commissions.length > 0 ? (
                  commissions
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, 5)
                    .map((commission, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="font-medium">{format(new Date(commission.date), "MMMM d, yyyy")}</p>
                          <p className="text-sm text-muted-foreground">
                            Commission: ${commission.commission.toFixed(2)} from {commission.customerEmail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${commission.amount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Total Sale</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground">No upcoming events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
