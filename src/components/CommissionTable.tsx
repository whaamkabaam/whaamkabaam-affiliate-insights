
import { useAffiliate, Commission } from "@/contexts/AffiliateContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface CommissionTableProps {
  limit?: number;
}

export function CommissionTable({ limit }: CommissionTableProps) {
  const { commissions, isLoading } = useAffiliate();

  const displayCommissions = limit
    ? commissions.slice(0, limit)
    : commissions;

  if (isLoading) {
    return <div className="text-center py-4">Loading commission data...</div>;
  }

  if (displayCommissions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No commission data available for the selected period.
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      <div>
        <div>{date.toLocaleDateString()}</div>
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(date, { addSuffix: true })}
        </div>
      </div>
    );
  };

  const formatProductName = (productId: string) => {
    const products: Record<string, string> = {
      "prod_RINKAvP3L2kZeV": "Basic Membership",
      "prod_RINJvQw1Qw1Qw1Q": "Premium Membership",
      "prod_RINO6yE0y4O9gX": "Enterprise Membership",
    };
    
    return products[productId] || productId;
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Commission</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayCommissions.map((commission) => (
            <TableRow key={commission.sessionId}>
              <TableCell>{formatDate(commission.date)}</TableCell>
              <TableCell>{commission.customerEmail}</TableCell>
              <TableCell>{formatProductName(commission.productId)}</TableCell>
              <TableCell className="text-right">${commission.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right font-medium text-primary">
                ${commission.commission.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
