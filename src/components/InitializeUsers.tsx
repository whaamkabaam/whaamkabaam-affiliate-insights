
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

// Get Supabase URL from the client file
const SUPABASE_URL = "https://xfkkmkxeoqawqnvahhoe.supabase.co";

interface UserResult {
  email: string;
  success: boolean;
  password?: string;
  exists?: boolean;
  error?: any;
}

interface SetupResponse {
  message: string;
  results: UserResult[];
  supabaseUrl?: string;
}

export function InitializeUsers({ isLoginPage = false }: { isLoginPage?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UserResult[] | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  const handleSetupUsers = async () => {
    if (!isAdmin && !isLoginPage) {
      toast.error("Only admins can initialize users");
      return;
    }
    
    setIsLoading(true);
    try {
      // Log the Supabase URL being used
      console.log("Using Supabase URL:", SUPABASE_URL);
      
      const { data, error } = await supabase.functions.invoke<SetupResponse>("setup-initial-users");
      
      if (error) {
        toast.error("Failed to initialize users: " + error.message);
        console.error("Error initializing users:", error);
        return;
      }
      
      if (data) {
        console.log("Supabase function response:", data);
        setResults(data.results);
        
        // Check if any users were actually created (not just existing)
        const createdUsers = data.results.filter(r => r.success && !r.exists);
        if (createdUsers.length > 0) {
          toast.success(`${createdUsers.length} users created successfully`);
        } else {
          toast.info("Generated new credentials for existing users");
        }
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const copyCredentials = (email: string, password: string) => {
    const text = `Email: ${email}\nPassword: ${password}`;
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedEmail(email);
        toast.success(`Copied ${email} credentials to clipboard`);
        setTimeout(() => setCopiedEmail(null), 3000);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  return (
    <Card className={isLoginPage ? "w-full max-w-md mx-auto mt-4" : "w-full"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Initialize Users
          <div className="text-xs text-muted-foreground flex items-center">
            <Info className="h-3 w-3 mr-1" /> 
            <span>Using {SUPABASE_URL}</span>
          </div>
        </CardTitle>
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
            <p className="font-medium text-amber-600">
              If users already exist, new passwords will be generated for reference.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">User Credentials:</h3>
            <ScrollArea className="h-80 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((user, i) => (
                    <TableRow key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.exists ? (
                          <span className="flex items-center text-amber-600 font-medium">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Already exists
                          </span>
                        ) : user.success ? (
                          <span className="flex items-center text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Success
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600 font-medium">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-all">
                        {user.password || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {user.password && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyCredentials(user.email, user.password!)}
                            className="h-8 px-2 py-0"
                          >
                            {copiedEmail === user.email ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
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
            disabled={isLoading || (!isAdmin && !isLoginPage)}
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
        {results && (
          <Button 
            onClick={() => setResults(null)}
            variant="outline" 
            className="w-full"
          >
            Reset
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
