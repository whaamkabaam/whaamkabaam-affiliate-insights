
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Commission } from "@/types/affiliate";
import { censorEmail } from "@/utils/emailUtils";

interface SelectedDatePanelProps {
  selectedDate: Date;
  selectedDateEvents: Commission[];
}

export function SelectedDatePanel({ selectedDate, selectedDateEvents }: SelectedDatePanelProps) {
  return (
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
                +${selectedDateEvents.reduce((sum, e) => sum + e.commission, 0).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedDateEvents.map((commission, index) => (
                <div key={index} className="p-3 bg-background/50 rounded-lg border border-primary/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">+${commission.commission.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(commission.date), "HH:mm")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Commission
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
  );
}
