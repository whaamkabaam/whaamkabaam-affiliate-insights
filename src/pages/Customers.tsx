
import { useEffect, useState } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { SearchIcon } from "lucide-react";

interface CustomerData {
  email: string;
  purchases: number;
  revenue: number;
  commission: number;
  lastPurchase: string;
}

export default function Customers() {
  const { fetchCommissionData, commissions } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  useEffect(() => {
    fetchCommissionData(selectedYear, selectedMonth);
  }, [fetchCommissionData, selectedYear, selectedMonth]);

  useEffect(() => {
    // Process customers from commissions
    const customerMap: Record<string, CustomerData> = {};
    
    commissions.forEach(commission => {
      const { customerEmail, amount, commission: commissionAmount, date } = commission;
      
      if (!customerMap[customerEmail]) {
        customerMap[customerEmail] = {
          email: customerEmail,
          purchases: 0,
          revenue: 0,
          commission: 0,
          lastPurchase: date
        };
      }
      
      customerMap[customerEmail].purchases += 1;
      customerMap[customerEmail].revenue += amount;
      customerMap[customerEmail].commission += commissionAmount;
      
      const currentDate = new Date(customerMap[customerEmail].lastPurchase);
      const newDate = new Date(date);
      if (newDate > currentDate) {
        customerMap[customerEmail].lastPurchase = date;
      }
    });
    
    setCustomers(Object.values(customerMap));
  }, [commissions]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <MonthPicker onMonthChange={handleMonthChange} />
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
            <Button variant="outline">Export CSV</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Last Purchase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.email}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar>
                            <div className="bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center h-full w-full">
                              {customer.email.charAt(0).toUpperCase()}
                            </div>
                          </Avatar>
                          {customer.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{customer.purchases}</TableCell>
                      <TableCell className="text-right">${customer.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${customer.commission.toFixed(2)}</TableCell>
                      <TableCell>{new Date(customer.lastPurchase).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredCustomers.length === 0 && (
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
