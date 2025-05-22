
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function InitializeUsers({ isLoginPage = false }: { isLoginPage?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleInitializeUsers = async () => {
    setIsLoading(true);

    try {
      console.log("Attempting to initialize users...");
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        message: string;
        users?: { email: string }[];
      }>("setup-initial-users");

      if (error) {
        console.error("Error initializing users:", error);
        toast.error("Failed to initialize users. Please try again.");
      } else if (data) {
        console.log("Users initialized:", data);
        if (data.success) {
          toast.success(
            data.users ? 
            `Created ${data.users.length} test users successfully` : 
            "Test users initialized successfully"
          );
        } else {
          toast.info(data.message || "Users might already exist. Try logging in.");
        }
      }
    } catch (err) {
      console.error("Exception during initialization:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex justify-center ${isLoginPage ? 'mt-4' : 'mt-8'}`}>
      <Button
        variant="outline"
        onClick={handleInitializeUsers}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Initializing Users...
          </>
        ) : (
          "Initialize Users"
        )}
      </Button>
    </div>
  );
}
