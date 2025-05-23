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
import { SearchIcon, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CustomerData {
  email: string;
  purchases: number;
  revenue: number;
  commission: number;
  lastPurchase: string;
}

export default function Customers() {
  const { fetchCommissionData, commissions } = useAffiliate();
  const { isAuthenticated, isAdmin } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch customers data from the database
  const fetchCustomers = async () => {
    setIsLoading(true);

    try {
      // Format date range for filtering
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();

      let query = supabase
        .from('promo_code_sales')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      // If user is not admin, filter by their affiliate code
      if (!isAdmin) {
        const { data: affiliateData } = await supabase
          .from('affiliates')
          .select('affiliate_code')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
          
        if (affiliateData?.affiliate_code) {
          query = query.eq('promo_code_name', affiliateData.affiliate_code);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (data) {
        // Process the data to group by customer
        const customerMap: Record<string, CustomerData> = {};
        
        data.forEach(sale => {
          if (!sale.customer_email) return;
          
          if (!customerMap[sale.customer_email]) {
            customerMap[sale.customer_email] = {
              email: sale.customer_email,
              purchases: 0,
              revenue: 0,
              commission: 0,
              lastPurchase: sale.created_at
            };
          }
          
          const customer = customerMap[sale.customer_email];
          customer.purchases += 1;
          customer.revenue += Number(sale.amount_paid) || 0;
          customer.commission += Number(sale.affiliate_commission) || 0;
          
          // Update last purchase date if newer
          if (new Date(sale.created_at) > new Date(customer.lastPurchase)) {
            customer.lastPurchase = sale.created_at;
          }
        });
        
        setCustomers(Object.values(customerMap));
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customer data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCustomers();
    }
  }, [isAuthenticated, selectedYear, selectedMonth]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export customers data as CSV
  const exportCsv = () => {
    if (filteredCustomers.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    // Create CSV content
    const headers = ["Email", "Purchases", "Revenue", "Commission", "Last Purchase"];
    const rows = filteredCustomers.map(customer => [
      customer.email,
      customer.purchases.toString(),
      customer.revenue.toFixed(2),
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
