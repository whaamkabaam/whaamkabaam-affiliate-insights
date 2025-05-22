
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UserResult {
  email: string;
  success: boolean;
  password?: string;
  error?: any;
}

interface SetupResponse {
  message: string;
  results: UserResult[];
}

export function InitializeUsers() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UserResult[] | null>(null);
  const { isAdmin } = useAuth();

  const handleSetupUsers = async () => {
    if (!isAdmin) {
      toast.error("Only admins can initialize users");
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<SetupResponse>("setup-initial-users");
      
      if (error) {
        toast.error("Failed to initialize users: " + error.message);
        console.error("Error initializing users:", error);
        return;
      }
      
      if (data) {
        setResults(data.results);
        toast.success("Users created successfully");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Initialize Users</CardTitle>
        <CardDescription>
          Set up initial users for testing the application
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!results ? (
          <div className="text-sm text-muted-foreground space-y-4">
            <p>
              This will create the following test users:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>admin@whaamkabaam.com (Admin)</li>
              <li>ayoub@whaamkabaam.com (Affiliate, code: ayoub)</li>
              <li>nic@whaamkabaam.com (Affiliate, code: nic)</li>
              <li>maru@whaamkabaam.com (Affiliate, code: maru)</li>
            </ul>
            <p>
              Random secure passwords will be generated for each user.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Created Users:</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-muted">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground tracking-wider">Password</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-muted">
                  {results.map((user, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{user.email}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {user.success ? (
                          <span className="text-green-600 font-medium">Success</span>
                        ) : (
                          <span className="text-red-600 font-medium">Failed</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                        {user.password || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Please save these credentials securely. You will need them to log in with these accounts.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {!results && (
          <Button 
            onClick={handleSetupUsers} 
            disabled={isLoading || !isAdmin}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up users...
              </>
            ) : (
              "Initialize Users"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
