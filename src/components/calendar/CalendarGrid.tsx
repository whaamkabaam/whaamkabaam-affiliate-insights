
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { CalendarDay } from "./CalendarDay";

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  hoveredDate: Date | null;
  datesWithEvents: Record<string, { count: number; totalAmount: number; totalCommission: number }>;
  onDateSelect: (date: Date) => void;
  onDateHover: (date: Date | null) => void;
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  hoveredDate,
  datesWithEvents,
  onDateSelect,
  onDateHover
}: CalendarGridProps) {
  // Generate calendar days using date-fns for better date handling
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay()); // Start from Sunday
    
    const calendarEnd = new Date(monthEnd);
    calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay())); // End on Saturday
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="calendar-container">
      <div className="grid grid-cols-7 gap-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="h-12 flex items-center justify-center font-medium bg-muted/10 text-muted-foreground border-r border-b border-border/30 last:border-r-0">
            {day}
          </div>
        ))}
        {calendarDays.map((day) => {
          const dateString = format(day, 'yyyy-MM-dd');
          const dayEvents = datesWithEvents[dateString];
          
          return (
            <CalendarDay
              key={day.toISOString()}
              day={day}
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              hoveredDate={hoveredDate}
              dayEvents={dayEvents}
              onDateSelect={onDateSelect}
              onDateHover={onDateHover}
            />
          );
        })}
      </div>
    </div>
  );
}
