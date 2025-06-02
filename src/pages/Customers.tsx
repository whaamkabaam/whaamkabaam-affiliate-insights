import { useEffect, useState, useCallback } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { SearchIcon, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { censorEmail } from "@/utils/emailUtils";
import { filterCommissions } from "@/utils/affiliateUtils";

interface CustomerData {
  email: string;
  purchases: number;
  revenue: number;
  commission: number;
  lastPurchase: string;
}

export default function Customers() {
  const { fetchCommissionData, commissions } = useAffiliate();
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Process commissions data to get customer information
  const processCustomerData = useCallback(() => {
    console.log(`Customers: Processing ${commissions.length} commissions`);
    // Filter commissions using the affiliate-specific filtering logic
    const filteredCommissions = filterCommissions(commissions, user?.affiliateCode);
    console.log(`Customers: After filtering, ${filteredCommissions.length} commissions remain`);
    
    const customerMap: Record<string, CustomerData> = {};
    
    filteredCommissions.forEach(commission => {
      if (!commission.customerEmail) return;
      
      if (!customerMap[commission.customerEmail]) {
        customerMap[commission.customerEmail] = {
          email: commission.customerEmail,
          purchases: 0,
          revenue: 0,
          commission: 0,
          lastPurchase: commission.date
        };
      }
      
      const customer = customerMap[commission.customerEmail];
      customer.purchases += 1;
      customer.revenue += commission.amount;
      customer.commission += commission.commission;
      
      // Update last purchase date if newer
      if (new Date(commission.date) > new Date(customer.lastPurchase)) {
        customer.lastPurchase = commission.date;
      }
    });
    
    const customerList = Object.values(customerMap);
    console.log(`Customers: Processed ${customerList.length} unique customers`);
    setCustomers(customerList);
  }, [commissions, user?.affiliateCode]);

  const handleMonthChange = useCallback(async (year: number, month: number) => {
    console.log(`Customers: Month changed to ${year}-${month}`);
    setIsLoading(true);
    setSelectedYear(year);
    setSelectedMonth(month);
    setHasFetched(false);
    
    if (user?.affiliateCode) {
      try {
        await fetchCommissionData(year, month, false);
        setHasFetched(true);
      } catch (error) {
        console.error("Error fetching customer data:", error);
        toast.error("Failed to load customer data");
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [user?.affiliateCode, fetchCommissionData]);

  // Initial data fetch
  useEffect(() => {
    if (user?.affiliateCode && !hasFetched) {
      console.log(`Customers: Initial fetch for ${user.affiliateCode}`);
      handleMonthChange(selectedYear, selectedMonth);
    }
  }, [user?.affiliateCode, selectedYear, selectedMonth, hasFetched, handleMonthChange]);

  // Process data when commissions change
  useEffect(() => {
    if (commissions.length > 0) {
      processCustomerData();
      setIsLoading(false);
    }
  }, [commissions, processCustomerData]);

  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export customers data as CSV
  const exportCsv = () => {
    if (filteredCustomers.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    // Create CSV content with censored emails (removed revenue column)
    const headers = ["Email", "Purchases", "Commission", "Last Purchase"];
    const rows = filteredCustomers.map(customer => [
      censorEmail(customer.email),
      customer.purchases.toString(),
      customer.commission.toFixed(2),
      new Date(customer.lastPurchase).toLocaleDateString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customers-${selectedYear}-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
              <p className="text-muted-foreground">
                Manage and view details about your referred customers.
              </p>
            </div>
            <MonthPicker onMonthChange={handleMonthChange} isLoading={isLoading} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search customers..." 
                className="pl-8" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={exportCsv}
              disabled={filteredCustomers.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Customers</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading customer data...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Purchases</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Last Purchase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => {
                      const censoredEmail = censorEmail(customer.email);
                      return (
                        <TableRow key={customer.email}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar>
                                <div className="bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center h-full w-full">
                                  {censoredEmail.charAt(0).toUpperCase()}
                                </div>
                              </Avatar>
                              {censoredEmail}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{customer.purchases}</TableCell>
                          <TableCell className="text-right">${customer.commission.toFixed(2)}</TableCell>
                          <TableCell>{new Date(customer.lastPurchase).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {!isLoading && filteredCustomers.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No customers found matching your search.
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
