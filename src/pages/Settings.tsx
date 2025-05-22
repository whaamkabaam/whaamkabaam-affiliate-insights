
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { ConfigForm } from "@/components/ConfigForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [notificationEmails, setNotificationEmails] = useState(true);
  const [notificationSales, setNotificationSales] = useState(true);
  
  const handleSavePersonalInfo = () => {
    toast.success("Personal information updated successfully");
  };
  
  const handleSaveNotifications = () => {
    toast.success("Notification preferences updated successfully");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and API configuration.
            </p>
          </div>

          <Tabs defaultValue="personal" className="space-y-4">
            <TabsList>
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="api">API Configuration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal information and preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSavePersonalInfo(); }}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" defaultValue={user?.name || ""} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue={user?.email || ""} disabled />
                        <p className="text-xs text-muted-foreground">Your email cannot be changed</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="affiliateCode">Affiliate Code</Label>
                      <Input id="affiliateCode" defaultValue={user?.affiliateCode} disabled />
                      <p className="text-xs text-muted-foreground">This is your unique affiliate code</p>
                    </div>
                    <Button type="submit" className="bg-brand-red hover:bg-brand-red/90">Save Changes</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Control what notifications you receive.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveNotifications(); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Email Notifications</div>
                        <div className="text-sm text-muted-foreground">Receive updates via email</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="notification-emails" className="sr-only">Email Notifications</Label>
                        <input
                          type="checkbox"
                          id="notification-emails"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={notificationEmails}
                          onChange={(e) => setNotificationEmails(e.target.checked)}
                        />
                      </div>
                    </div>
                    
                    <hr />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Sales Notifications</div>
                        <div className="text-sm text-muted-foreground">Get notified when a sale is made with your code</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="notification-sales" className="sr-only">Sales Notifications</Label>
                        <input
                          type="checkbox"
                          id="notification-sales"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={notificationSales}
                          onChange={(e) => setNotificationSales(e.target.checked)}
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="bg-brand-red hover:bg-brand-red/90">Save Changes</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="api">
              <ConfigForm />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
