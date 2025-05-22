
import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useAffiliate } from "@/contexts/AffiliateContext";

export default function Calendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { commissions } = useAffiliate();
  
  // Create a map of dates with commissions
  const datesWithCommissions = commissions.reduce<Record<string, { count: number, amount: number }>>(
    (acc, commission) => {
      const dateStr = new Date(commission.date).toDateString();
      
      if (!acc[dateStr]) {
        acc[dateStr] = { count: 0, amount: 0 };
      }
      
      acc[dateStr].count += 1;
      acc[dateStr].amount += commission.commission;
      
      return acc;
    },
    {}
  );
  
  // Selected day commissions
  const selectedDayCommissions = date 
    ? commissions.filter(c => new Date(c.date).toDateString() === date.toDateString())
    : [];
  
  const totalSelectedDayCommission = selectedDayCommissions.reduce(
    (sum, commission) => sum + commission.commission, 
    0
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground">
              View your commission activity by date.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Commission Calendar</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="border rounded-md p-3"
                  modifiers={{
                    booked: (date) => {
                      const dateStr = date.toDateString();
                      return dateStr in datesWithCommissions;
                    },
                  }}
                  modifiersStyles={{
                    booked: {
                      backgroundColor: "rgba(255, 63, 78, 0.1)",
                      borderRadius: "0",
                    },
                  }}
                  components={{
                    DayContent: ({ date, ...props }) => {
                      const dateStr = date.toDateString();
                      const hasCommissions = dateStr in datesWithCommissions;
                      
                      return (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div {...props} />
                          {hasCommissions && (
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-brand-red rounded-full" />
                          )}
                        </div>
                      );
                    },
                  }}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>
                  {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Select a Date"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {date ? (
                  selectedDayCommissions.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div className="font-medium">Total Commission:</div>
                        <div className="text-xl font-bold text-primary">${totalSelectedDayCommission.toFixed(2)}</div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="font-medium">Transactions:</div>
                        
                        <div className="space-y-2">
                          {selectedDayCommissions.map((commission) => (
                            <div key={commission.sessionId} className="flex justify-between items-center p-2 bg-muted/50 rounded-md">
                              <div>{commission.customerEmail}</div>
                              <div className="font-medium">${commission.commission.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions on this date
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a date on the calendar to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
