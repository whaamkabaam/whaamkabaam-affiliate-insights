
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Eye, EyeOff, Key, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  user_metadata: {
    name?: string;
  };
  email_confirmed_at: string | null;
}

interface PasswordChangeForm {
  userId: string;
  newPassword: string;
  confirmPassword: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    userId: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error("Error fetching users:", error);
        toast.error(`Failed to fetch users: ${error.message}`);
        return;
      }
      
      if (data?.users) {
        setUsers(data.users);
        toast.success(`Retrieved ${data.users.length} users`);
      }
    } catch (error) {
      console.error("Error calling admin users:", error);
      toast.error("Failed to retrieve users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.userId || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.admin.updateUserById(
        passwordForm.userId,
        { password: passwordForm.newPassword }
      );

      if (error) {
        toast.error(`Failed to update password: ${error.message}`);
      } else {
        toast.success("Password updated successfully");
        setPasswordForm({ userId: "", newPassword: "", confirmPassword: "" });
        setDialogOpen(false);
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const openPasswordDialog = (userId: string) => {
    setPasswordForm({ userId, newPassword: "", confirmPassword: "" });
    setDialogOpen(true);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={fetchUsers}
            disabled={loadingUsers}
            className="w-full"
          >
            {loadingUsers ? "Loading..." : "Refresh User List"}
          </Button>
          
          {users.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Current Users:</h4>
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="font-medium">{user.user_metadata?.name || "No Name"}</div>
                        <div className="text-sm text-muted-foreground">
                          Email: {user.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm">
                          Status: <span className={user.email_confirmed_at ? "text-green-600" : "text-yellow-600"}>
                            {user.email_confirmed_at ? "Verified" : "Unverified"}
                          </span>
                        </div>
                      </div>
                      <Dialog open={dialogOpen && passwordForm.userId === user.id} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPasswordDialog(user.id)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Change Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>
                              Change password for {user.email}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="newPassword">New Password</Label>
                              <div className="relative">
                                <Input
                                  id="newPassword"
                                  type={showPassword ? "text" : "password"}
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm(prev => ({...prev, newPassword: e.target.value}))}
                                  placeholder="Enter new password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="confirmPassword">Confirm Password</Label>
                              <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm(prev => ({...prev, confirmPassword: e.target.value}))}
                                placeholder="Confirm new password"
                              />
                            </div>
                            <Button 
                              onClick={handlePasswordChange}
                              disabled={changingPassword}
                              className="w-full"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {changingPassword ? "Updating..." : "Update Password"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
