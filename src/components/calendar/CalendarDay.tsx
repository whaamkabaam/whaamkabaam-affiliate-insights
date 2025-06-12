
import { format, isSameMonth, isSameDay, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Star, Sparkles, TrendingUp } from "lucide-react";
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

  const getIntensityClass = () => {
    if (!hasEvents) return "";
    const commission = dayEvents.totalCommission;
    if (commission >= 100) return "bg-gradient-to-br from-emerald-100 to-green-200 border-emerald-300";
    if (commission >= 50) return "bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200";
    if (commission >= 20) return "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200";
    return "bg-gradient-to-br from-green-25 to-emerald-25 border-green-100";
  };

  return (
    <div 
      className={cn(
        "relative aspect-square border border-border/50 p-3 cursor-pointer transition-all duration-300 group flex flex-col",
        "hover:border-primary/50 hover:shadow-md hover:scale-105",
        !isCurrentMonth && "text-muted-foreground/40 bg-muted/20",
        isDayToday && "ring-2 ring-primary/60 bg-primary/10 shadow-lg",
        isSelected && "bg-primary/20 border-primary shadow-lg ring-2 ring-primary/40",
        isHovered && "bg-primary/10 shadow-md",
        hasEvents && isCurrentMonth && getIntensityClass(),
        hasEvents && "hover:shadow-lg hover:border-primary/60"
      )}
      onClick={() => onDateSelect(day)}
      onMouseEnter={() => onDateHover(day)}
      onMouseLeave={() => onDateHover(null)}
    >
      {/* Date number and indicators */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          "font-semibold text-base leading-none transition-all duration-200",
          !isCurrentMonth && "text-muted-foreground/50",
          isDayToday && "text-primary font-bold text-lg",
          isSelected && "text-primary font-bold",
          hasEvents && isCurrentMonth && "text-emerald-700 font-bold"
        )}>
          {format(day, 'd')}
        </div>
        <div className="flex items-center gap-1">
          {isDayToday && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 animate-pulse" />
          )}
          {hasEvents && isCurrentMonth && (
            <TrendingUp className="w-3 h-3 text-emerald-600" />
          )}
        </div>
      </div>
      
      {/* Events content - enhanced design */}
      {hasEvents && isCurrentMonth && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-2">
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs px-2 py-1 font-medium transition-all duration-200 group-hover:scale-110",
              "bg-emerald-200 text-emerald-800 border-emerald-300",
              "shadow-sm group-hover:shadow-md"
            )}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {dayEvents.count} sale{dayEvents.count > 1 ? 's' : ''}
          </Badge>
          
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-700 leading-none">
              +${dayEvents.totalCommission.toFixed(2)}
            </div>
            <div className="text-xs text-emerald-600 opacity-80">
              commission
            </div>
          </div>
          
          {/* Revenue indicator */}
          <div className="text-xs text-muted-foreground">
            ${dayEvents.totalAmount.toFixed(0)} revenue
          </div>
        </div>
      )}
      
      {/* Hover effect overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-primary/5 border border-primary/30 rounded transition-all duration-200" />
      )}
    </div>
  );
}
