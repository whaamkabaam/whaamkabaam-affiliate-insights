
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
import { AlertCircle } from "lucide-react";

interface CommissionTableProps {
  limit?: number;
}

export function CommissionTable({ limit }: CommissionTableProps) {
  const { commissions, isLoading, isAdmin } = useAffiliate();

  const displayCommissions = limit
    ? commissions.slice(0, limit)
    : commissions;

  if (isLoading) {
    return <div className="text-center py-4">Loading commission data...</div>;
  }

  if (isAdmin) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <AlertCircle className="h-4 w-4 mr-2" />
        <span>Detailed commission data is available in individual affiliate accounts</span>
      </div>
    );
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

  const formatCustomerName = (email: string) => {
    // Extract name from email (assuming format is firstname.lastname@domain.com)
    const [namePart] = email.split('@');
    let firstName = '';
    let lastName = '';
    
    if (namePart.includes('.')) {
      // If email has format firstname.lastname@domain
      [firstName, lastName] = namePart.split('.');
    } else {
      // If no period in the name part, assume the whole thing is the first name
      firstName = namePart;
      lastName = '';
    }
    
    // Capitalize first letters for better display
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    if (lastName) {
      lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
    }
    
    // Format first name (first letter + *** + last letter)
    let formattedFirstName = firstName;
    if (firstName.length > 2) {
      formattedFirstName = `${firstName.charAt(0)}***${firstName.charAt(firstName.length - 1)}`;
    }
    
    // Format last name (just first letter with a period)
    const formattedLastName = lastName ? `${lastName.charAt(0)}.` : '';
    
    return `${formattedFirstName} ${formattedLastName}`.trim();
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
              <TableCell>
                {formatCustomerName(commission.customerEmail)}
                <div className="text-xs text-muted-foreground">
                  {commission.customerEmail}
                </div>
              </TableCell>
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
