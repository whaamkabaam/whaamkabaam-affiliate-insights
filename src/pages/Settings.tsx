
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  
  const handleSavePersonalInfo = () => {
    toast.success("Personal information updated successfully");
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
              Manage your account settings and preferences.
            </p>
          </div>

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
        </main>
      </div>
    </div>
  );
}
