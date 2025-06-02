
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarHeaderProps {
  currentMonth: Date;
  isLoading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function CalendarHeader({ currentMonth, isLoading, onPrevMonth, onNextMonth }: CalendarHeaderProps) {
  return (
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
          onClick={onPrevMonth} 
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
          onClick={onNextMonth} 
          disabled={isLoading}
          className="hover:bg-primary/10 hover:border-primary/30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
