
import { useAffiliate } from "@/contexts/AffiliateContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductBadge } from "./ProductBadge";
import { AlertCircle } from "lucide-react";
import { censorEmail } from "@/utils/emailUtils";

interface CommissionTableProps {
  limit?: number;
}

export function CommissionTable({ limit }: CommissionTableProps) {
  const { commissions, isLoading, error } = useAffiliate();
  const { user, isAdmin } = useAuth();
  
  // For admin users, show all network transactions by getting all commissions
  const displayCommissions = isAdmin ? commissions : commissions;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commission Details</CardTitle>
          <CardDescription>Loading transaction data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                {isAdmin && <Skeleton className="h-4 w-16" />}
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!displayCommissions || displayCommissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? "All Network Transactions" : "Commission Details"}
          </CardTitle>
          <CardDescription>
            {isAdmin ? "Network-wide affiliate transactions" : "Your recent affiliate transactions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No transactions found.
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayTransactions = limit ? displayCommissions.slice(0, limit) : displayCommissions;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isAdmin ? "All Network Transactions" : "Commission Details"}
        </CardTitle>
        <CardDescription>
          {isAdmin 
            ? `Network-wide transactions${limit ? ` (latest ${limit})` : ""}`
            : `${limit ? `Latest ${limit} transactions` : 'All transactions'} for ${user?.affiliateCode || 'your account'}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                {isAdmin && <TableHead>Affiliate</TableHead>}
                {isAdmin && <TableHead>Amount</TableHead>}
                <TableHead>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTransactions.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {new Date(transaction.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {censorEmail(transaction.customerEmail)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProductBadge 
                      productId={transaction.productId} 
                      size="sm"
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <span className="px-2 py-1 bg-secondary rounded text-sm">
                        {transaction.affiliateCode || 'Unknown'}
                      </span>
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell>${transaction.amount?.toFixed(2) || '0.00'}</TableCell>
                  )}
                  <TableCell className="font-semibold text-green-600">
                    ${transaction.commission?.toFixed(2) || '0.00'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
