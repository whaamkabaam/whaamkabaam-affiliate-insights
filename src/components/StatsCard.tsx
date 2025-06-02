
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  isLoading?: boolean;
  showCopyButton?: boolean;
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  isLoading = false,
  showCopyButton = false,
}: StatsCardProps) {
  const handleCopy = () => {
    if (typeof value === 'string' || typeof value === 'number') {
      navigator.clipboard.writeText(value.toString());
      toast.success("Code copied to clipboard!");
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {icon && <div className="w-4 h-4 text-muted-foreground">{icon}</div>}
          {showCopyButton && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            {description && <Skeleton className="h-4 w-32" />}
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <div
                className={cn(
                  "text-xs font-medium mt-2",
                  trend.isPositive ? "text-green-500" : "text-red-500"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
