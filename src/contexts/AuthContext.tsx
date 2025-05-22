
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, AppRole, AffiliateData } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

export interface UserWithRole extends User {
  role?: AppRole;
  affiliateCode?: string;
  name?: string;
}

interface AuthContextType {
  user: UserWithRole | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
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
      // Check if user is admin using RPC function
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { user_id: userId });

      if (roleError) {
        console.error("Error checking admin role:", roleError);
      }
      
      // Get affiliate code if exists using RPC function
      const { data: affiliateData, error: affiliateError } = await supabase
        .rpc('get_affiliate_data', { user_id: userId });

      if (affiliateError) {
        console.error("Error fetching affiliate data:", affiliateError);
      }

      // Get user profile for name from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', userId)
        .single();

      if (profileError && profileError.message !== 'No rows found') {
        console.error("Error fetching profile data:", profileError);
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
      
      // Use null coalescing for safe access
      setIsAdmin(roleData === 'admin');
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          const extendedUser = newSession.user as UserWithRole;
          setUser(extendedUser);
          
          // Use setTimeout to prevent Supabase authentication deadlocks
          setTimeout(() => {
            fetchUserData(newSession.user.id);
          }, 0);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        const extendedUser = existingSession.user as UserWithRole;
        setUser(extendedUser);
        fetchUserData(existingSession.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Login failed");
      toast.error(err.message || "Login failed");
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
