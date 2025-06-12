
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Commission } from "@/types/affiliate";
import { censorEmail } from "@/utils/emailUtils";

interface RecentEventsPanelProps {
  commissions: Commission[];
}

// Helper function to format date in European format (DD/MM)
const formatEuropeanDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

export function RecentEventsPanel({ commissions }: RecentEventsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {commissions.length > 0 ? (
            commissions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((commission, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2 hover:bg-muted/20 -mx-2 px-2 py-2 rounded transition-colors">
                  <div>
                    <p className="font-medium">{formatEuropeanDateShort(commission.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      Commission
                    </p>
                    <p className="text-xs text-muted-foreground">
                      from {censorEmail(commission.customerEmail)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-emerald-600">+${commission.commission.toFixed(2)}</p>
                  </div>
                </div>
              ))
          ) : (
            <p className="text-muted-foreground">No commission events found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
