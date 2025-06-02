
import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";

interface MonthPickerProps {
  onMonthChange: (year: number, month: number) => void;
}

export function MonthPicker({ onMonthChange }: MonthPickerProps) {
  const currentDate = new Date();
  // Start with all-time view (0, 0)
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);

  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - i
  );

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Only call onMonthChange when component mounts initially
  useEffect(() => {
    onMonthChange(selectedYear, selectedMonth);
  }, []); // Empty dependency array - only run on mount

  // Separate effect for when values actually change
  const handleSelectionChange = useCallback((year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onMonthChange(year, month);
  }, [onMonthChange]);

  const handleAllTimeClick = useCallback(() => {
    handleSelectionChange(0, 0);
  }, [handleSelectionChange]);

  const handleCurrentMonthClick = useCallback(() => {
    handleSelectionChange(currentDate.getFullYear(), currentDate.getMonth() + 1);
  }, [handleSelectionChange, currentDate]);

  const isAllTime = selectedYear === 0 && selectedMonth === 0;
  const isCurrentMonth = selectedYear === currentDate.getFullYear() && 
                        selectedMonth === currentDate.getMonth() + 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button 
        variant={isAllTime ? "default" : "outline"} 
        size="sm"
        onClick={handleAllTimeClick}
        className="flex items-center gap-2"
      >
        <Clock className="w-4 h-4" />
        All Time
      </Button>
      
      <Button 
        variant={isCurrentMonth ? "default" : "outline"} 
        size="sm"
        onClick={handleCurrentMonthClick}
        className="flex items-center gap-2"
      >
        <Calendar className="w-4 h-4" />
        Current Month
      </Button>

      <div className="flex items-center gap-2">
        <Select
          value={selectedMonth.toString()}
          onValueChange={(value) => {
            const month = parseInt(value);
            const year = month > 0 && selectedYear === 0 ? currentDate.getFullYear() : selectedYear;
            handleSelectionChange(year, month);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((month, index) => (
              <SelectItem key={index + 1} value={(index + 1).toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => {
            const year = parseInt(value);
            const month = selectedMonth === 0 ? currentDate.getMonth() + 1 : selectedMonth;
            handleSelectionChange(year, month);
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
