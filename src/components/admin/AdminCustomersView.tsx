
import { useEffect, useState, useCallback } from "react";
import { useAffiliate } from "@/contexts/AffiliateContext";
import { MonthPicker } from "@/components/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, Download, Users, DollarSign, TrendingUp, Filter } from "lucide-react";
import { toast } from "sonner";
import { filterCommissions } from "@/utils/affiliateUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatsCard } from "@/components/StatsCard";

interface CustomerData {
  email: string;
  purchases: number;
  revenue: number;
  commission: number;
  lastPurchase: string;
  affiliateCode?: string;
}

export const AdminCustomersView = () => {
  const { fetchCommissionData, commissions, affiliateOverviews } = useAffiliate();
  const [selectedYear, setSelectedYear] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>("all");
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  // Filter out admin from affiliate overviews
  const realAffiliates = affiliateOverviews.filter(affiliate => 
    affiliate.affiliateCode !== 'admin' && 
    affiliate.email !== 'admin@whaamkabaam.com'
  );

  // Process commissions data to get customer information with affiliate details
  const processCustomerData = useCallback(() => {
    console.log(`Admin Customers: Processing ${commissions.length} commissions`);
    
    // Apply affiliate filter if specific affiliate is selected
    const filteredCommissions = selectedAffiliate === "all" 
      ? filterCommissions(commissions) // Remove only test data, keep all real affiliate data
      : filterCommissions(commissions, selectedAffiliate);
    
    console.log(`Admin Customers: After filtering, ${filteredCommissions.length} commissions remain`);
    
    const customerMap: Record<string, CustomerData> = {};
    
    filteredCommissions.forEach(commission => {
      if (!commission.customerEmail) return;
      
      if (!customerMap[commission.customerEmail]) {
        customerMap[commission.customerEmail] = {
          email: commission.customerEmail,
          purchases: 0,
          revenue: 0,
          commission: 0,
          lastPurchase: commission.date,
          affiliateCode: commission.affiliateCode || 'unknown'
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
    
    const customerList = Object.values(customerMap).sort((a, b) => b.revenue - a.revenue);
    console.log(`Admin Customers: Processed ${customerList.length} unique customers`);
    setCustomers(customerList);
  }, [commissions, selectedAffiliate]);

  const handleMonthChange = useCallback(async (year: number, month: number) => {
    console.log(`Admin Customers: Month changed to ${year}-${month}`);
    setIsLoading(true);
    setSelectedYear(year);
    setSelectedMonth(month);
    setHasFetched(false);
    
    try {
      await fetchCommissionData(year, month, false);
      setHasFetched(true);
    } catch (error) {
      console.error("Error fetching customer data:", error);
      toast.error("Failed to load customer data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchCommissionData]);

  // Initial data fetch
  useEffect(() => {
    if (!hasFetched) {
      console.log(`Admin Customers: Initial fetch`);
      handleMonthChange(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth, hasFetched, handleMonthChange]);

  // Process data when commissions change
  useEffect(() => {
    if (commissions.length > 0) {
      processCustomerData();
      setIsLoading(false);
    }
  }, [commissions, processCustomerData]);

  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.affiliateCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate summary stats
  const totalCustomers = filteredCustomers.length;
  const totalRevenue = filteredCustomers.reduce((sum, customer) => sum + customer.revenue, 0);
  const totalCommission = filteredCustomers.reduce((sum, customer) => sum + customer.commission, 0);
  const avgOrderValue = totalCustomers > 0 ? totalRevenue / filteredCustomers.reduce((sum, customer) => sum + customer.purchases, 0) : 0;

  // Export customers data as CSV (uncensored for admin)
  const exportCsv = () => {
    if (filteredCustomers.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    const headers = ["Email", "Affiliate", "Purchases", "Revenue", "Commission", "Last Purchase"];
    const rows = filteredCustomers.map(customer => [
      customer.email, // Uncensored for admin
      customer.affiliateCode || 'unknown',
      customer.purchases.toString(),
      customer.revenue.toFixed(2),
      customer.commission.toFixed(2),
      new Date(customer.lastPurchase).toLocaleDateString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `network-customers-${selectedYear}-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Network Customers</h1>
          <p className="text-muted-foreground">
            Complete overview of all customers across your affiliate network
          </p>
        </div>
        <MonthPicker onMonthChange={handleMonthChange} isLoading={isLoading} />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={totalCustomers}
          description={selectedAffiliate === "all" ? "Across all affiliates" : `From ${selectedAffiliate}`}
          icon={<Users className="w-4 h-4" />}
          className="bg-blue-50 border-blue-200"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          description="Generated by customers"
          icon={<DollarSign className="w-4 h-4" />}
          className="bg-green-50 border-green-200"
        />
        <StatsCard
          title="Total Commission"
          value={`$${totalCommission.toFixed(2)}`}
          description="Paid to affiliates"
          icon={<TrendingUp className="w-4 h-4" />}
          className="bg-purple-50 border-purple-200"
        />
        <StatsCard
          title="Avg Order Value"
          value={`$${avgOrderValue.toFixed(2)}`}
          description="Per purchase"
          icon={<TrendingUp className="w-4 h-4" />}
          className="bg-orange-50 border-orange-200"
        />
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-96">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search customers or affiliates..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by affiliate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Affiliates</SelectItem>
                {realAffiliates.map((affiliate) => (
                  <SelectItem key={affiliate.affiliateCode} value={affiliate.affiliateCode}>
                    {affiliate.affiliateCode} ({affiliate.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <CardTitle>
            {selectedAffiliate === "all" ? "All Network Customers" : `${selectedAffiliate} Customers`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading customer data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Last Purchase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer, index) => (
                    <TableRow key={`${customer.email}-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar>
                            <div className="bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center h-full w-full">
                              {customer.email.charAt(0).toUpperCase()}
                            </div>
                          </Avatar>
                          <span className="max-w-xs truncate">{customer.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {customer.affiliateCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{customer.purchases}</TableCell>
                      <TableCell className="text-right font-medium">${customer.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">${customer.commission.toFixed(2)}</TableCell>
                      <TableCell>{new Date(customer.lastPurchase).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No customers found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
