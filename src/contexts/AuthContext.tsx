
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, AppRole, AffiliateData } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface UserWithRole extends User {
  role?: AppRole;
  affiliateCode?: string;
  name?: string;
}

// Updated the return type of login function to match what Supabase actually returns
interface AuthContextType {
  user: UserWithRole | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{
    user: User | null;
    session: Session | null;
    weakPassword?: unknown | null;
  }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Function to fetch additional user data like role and affiliate code
  const fetchUserData = async (userId: string) => {
    try {
      console.log("Fetching additional user data for:", userId);
      
      // Check if user is admin using RPC function
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { user_id: userId });

      if (roleError) {
        console.error("Error checking admin role:", roleError);
      } else {
        console.log("User role:", roleData);
      }
      
      // Get affiliate code if exists using RPC function
      const { data: affiliateData, error: affiliateError } = await supabase
        .rpc('get_affiliate_data', { user_id: userId });

      if (affiliateError) {
        console.error("Error fetching affiliate data:", affiliateError);
      } else {
        console.log("Affiliate data:", affiliateData);
      }

      // Get user profile for name from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile data:", profileError);
      } else {
        console.log("Profile data:", profileData);
      }

      // Parse and extract data from the affiliateData JSON
      let affiliateCode: string | undefined = undefined;
      if (affiliateData && typeof affiliateData === 'object') {
        // Handle the JSON object safely
        const parsedData = affiliateData as unknown as AffiliateData;
        affiliateCode = parsedData.affiliate_code;
      }

      // Update user with additional data
      setUser(prevUser => {
        if (!prevUser) return null;
        
        const updatedUser: UserWithRole = { 
          ...prevUser,
          role: roleData === 'admin' ? 'admin' : 'affiliate',
          affiliateCode: affiliateCode,
          name: profileData?.full_name || profileData?.display_name || prevUser.email?.split('@')[0] || undefined
        };
        
        return updatedUser;
      });
      
      setIsAdmin(roleData === 'admin');
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  useEffect(() => {
    console.log("Setting up auth state listener");
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state changed, event:", event);
        setSession(newSession);
        
        if (newSession?.user) {
          console.log("User in session:", newSession.user.email);
          const extendedUser = newSession.user as UserWithRole;
          setUser(extendedUser);
          
          // Use setTimeout to prevent Supabase authentication deadlocks
          setTimeout(() => {
            fetchUserData(newSession.user.id);
          }, 0);
        } else {
          console.log("No user in session");
          setUser(null);
          setIsAdmin(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      console.log("Checking for existing session");
      setSession(existingSession);
      
      if (existingSession?.user) {
        console.log("Found existing session for user:", existingSession.user.email);
        const extendedUser = existingSession.user as UserWithRole;
        setUser(extendedUser);
        
        setTimeout(() => {
          fetchUserData(existingSession.user.id);
        }, 0);
      } else {
        console.log("No existing session found");
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Attempting to sign in with email: ${email}`);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error("Login error:", error);
        setError(error.message || "Login failed");
        throw error;
      }
      
      console.log("Login successful:", data);
      return data;
    } catch (err: any) {
      console.error("Login exception:", err);
      
      // Try to initialize users automatically if login fails
      if (email === "admin@whaamkabaam.com" && password === "AdminTest123") {
        try {
          console.log("Attempting to initialize users via edge function...");
          const { data: initData, error: initError } = await supabase.functions.invoke<any>("setup-initial-users");
          
          if (initError) {
            console.error("Error initializing users:", initError);
          } else if (initData) {
            console.log("Users initialized:", initData);
            toast.info("Created test users. Please try logging in again.");
            setError("Users initialized. Please try logging in again.");
            throw new Error("Users initialized. Please try logging in again.");
          }
        } catch (initErr) {
          console.error("Error during user initialization:", initErr);
        }
      }
      
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      toast.success("Successfully logged out");
    } catch (err: any) {
      console.error("Logout error:", err.message);
      toast.error("Failed to log out");
    }
  };

  const value = {
    user,
    session,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
