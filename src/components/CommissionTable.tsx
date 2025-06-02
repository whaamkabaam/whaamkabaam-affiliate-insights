
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import { censorEmail } from "@/utils/emailUtils";
import { filterCommissions } from "@/utils/affiliateUtils";
import { getProductName } from "@/utils/productUtils";

interface CommissionTableProps {
  limit?: number;
}

export function CommissionTable({ limit }: CommissionTableProps) {
  const { commissions, isLoading } = useAffiliate();
  const { user } = useAuth();

  // Filter commissions using the affiliate-specific filtering logic
  const filteredCommissions = filterCommissions(commissions, user?.affiliateCode);

  const displayCommissions = limit 
    ? filteredCommissions.slice(0, limit)
    : filteredCommissions;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayCommissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No commission data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayCommissions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((commission, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {new Date(commission.date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistance(new Date(commission.date), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {censorEmail(commission.customerEmail)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {getProductName(commission.productId)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    ${commission.commission.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
