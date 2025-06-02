
import { format, isSameMonth, isSameDay, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarDayProps {
  day: Date;
  currentMonth: Date;
  selectedDate: Date | null;
  hoveredDate: Date | null;
  dayEvents?: { count: number; totalAmount: number; totalCommission: number };
  onDateSelect: (date: Date) => void;
  onDateHover: (date: Date | null) => void;
}

export function CalendarDay({
  day,
  currentMonth,
  selectedDate,
  hoveredDate,
  dayEvents,
  onDateSelect,
  onDateHover
}: CalendarDayProps) {
  const hasEvents = dayEvents && dayEvents.count > 0;
  const isCurrentMonth = isSameMonth(day, currentMonth);
  const isDayToday = isToday(day);
  const isSelected = selectedDate && isSameDay(day, selectedDate);
  const isHovered = hoveredDate && isSameDay(day, hoveredDate);

  return (
    <div 
      className={cn(
        "relative aspect-square border border-border/50 p-2 cursor-pointer transition-all duration-200 group flex flex-col",
        "hover:border-primary/40 hover:bg-primary/5",
        !isCurrentMonth && "text-muted-foreground/40",
        isDayToday && "ring-2 ring-primary/50 bg-primary/5",
        isSelected && "bg-primary/10 border-primary/60 ring-1 ring-primary/30",
        isHovered && "bg-primary/5"
      )}
      onClick={() => onDateSelect(day)}
      onMouseEnter={() => onDateHover(day)}
      onMouseLeave={() => onDateHover(null)}
    >
      {/* Date number and today indicator */}
      <div className="flex items-center justify-between mb-1">
        <div className={cn(
          "font-medium text-sm leading-none",
          !isCurrentMonth && "text-muted-foreground/50",
          isDayToday && "text-primary font-bold",
          isSelected && "text-primary font-semibold"
        )}>
          {format(day, 'd')}
        </div>
        {isDayToday && (
          <Star className="w-3 h-3 text-amber-500 fill-amber-400 flex-shrink-0" />
        )}
      </div>
      
      {/* Events content - improved compact layout */}
      {hasEvents && isCurrentMonth && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-1.5">
          <Badge 
            variant="secondary" 
            className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 group-hover:scale-105 transition-transform duration-200 font-medium"
          >
            <Sparkles className="w-2.5 h-2.5 mr-1" />
            {dayEvents.count} sale{dayEvents.count > 1 ? 's' : ''}
          </Badge>
          
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-none">
            +${dayEvents.totalCommission.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
