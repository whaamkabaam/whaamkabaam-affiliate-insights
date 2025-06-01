
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

  // Helper function to create a promise with timeout (reduced to 3 seconds)
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  // Enhanced email-based fallback mapping
  const getAffiliateCodeFromEmail = (email: string): string | undefined => {
    const emailLower = email.toLowerCase();
    const emailToCodeMap: Record<string, string> = {
      'nic@whaamkabaam.com': 'nic',
      'maru@whaamkabaam.com': 'maru',
      'ayoub@whaamkabaam.com': 'ayoub'
    };
    return emailToCodeMap[emailLower];
  };

  // Optimized fetchUserData function with improved error handling and fallbacks
  const fetchUserData = async (userId: string, currentUser: User): Promise<UserWithRole> => {
    try {
      console.log("AuthContext: Starting fetchUserData for userId:", userId);

      // Reduce timeout to 3 seconds since we've optimized the database
      const timeoutMs = 3000;
      
      console.log("AuthContext: Making concurrent RPC calls with reduced timeout...");
      
      // First, try to get affiliate code from user metadata or email fallback
      let primaryAffiliateCode = currentUser.user_metadata?.affiliate_code;
      if (!primaryAffiliateCode && currentUser.email) {
        primaryAffiliateCode = getAffiliateCodeFromEmail(currentUser.email);
        console.log("AuthContext: Using email-based fallback for affiliate code:", primaryAffiliateCode);
      }

      // Perform data fetching operations concurrently with timeout
      const [roleResult, affiliateResult, profileResult] = await Promise.allSettled([
        withTimeout(
          Promise.resolve(supabase.rpc('get_user_role', { user_id: userId })),
          timeoutMs,
          'get_user_role'
        ),
        withTimeout(
          Promise.resolve(supabase.rpc('get_affiliate_data', { p_user_id: userId })),
          timeoutMs,
          'get_affiliate_data'
        ),
        withTimeout(
          Promise.resolve(supabase.from('profiles').select('full_name, display_name').eq('id', userId).maybeSingle()),
          timeoutMs,
          'profiles_query'
        )
      ]);

      console.log("AuthContext: All promises resolved. Processing results...");

      // Process results with improved error handling
      const roleData = roleResult.status === 'fulfilled' ? roleResult.value.data : null;
      const roleError = roleResult.status === 'rejected' ? roleResult.reason : (roleResult.status === 'fulfilled' ? roleResult.value.error : null);

      const affiliateRpcData = affiliateResult.status === 'fulfilled' ? affiliateResult.value.data : null;
      const affiliateError = affiliateResult.status === 'rejected' ? affiliateResult.reason : (affiliateResult.status === 'fulfilled' ? affiliateResult.value.error : null);

      const profileData = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
      const profileError = profileResult.status === 'rejected' ? profileResult.reason : (profileResult.status === 'fulfilled' ? profileResult.value.error : null);

      // Log any errors encountered during fetching
      if (roleError) console.error("AuthContext: Error checking admin role:", roleError.message || roleError);
      if (affiliateError) console.error("AuthContext: Error fetching affiliate data from RPC:", affiliateError.message || affiliateError);
      if (profileError) console.error("AuthContext: Error fetching profile data:", profileError.message || profileError);

      console.log("AuthContext: User role data from RPC:", roleData);
      console.log("AuthContext: Affiliate data from RPC (get_affiliate_data):", affiliateRpcData);
      console.log("AuthContext: Profile data from DB:", profileData);

      // Determine affiliate code with improved fallback logic
      let determinedAffiliateCode = primaryAffiliateCode; // Start with metadata or email fallback
      console.log("AuthContext: Primary affiliate code (metadata/email):", determinedAffiliateCode);

      // Try to get affiliate_code from the RPC call's result if we don't have one yet
      if (!determinedAffiliateCode && affiliateRpcData && typeof affiliateRpcData === 'object' && 'affiliate_code' in affiliateRpcData) {
        const rpcAffiliateCode = (affiliateRpcData as { affiliate_code?: string }).affiliate_code;
        if (rpcAffiliateCode) {
          determinedAffiliateCode = rpcAffiliateCode;
          console.log("AuthContext: Affiliate code from RPC (get_affiliate_data):", determinedAffiliateCode);
        }
      }

      // Final fallback - use email-based assignment if we still don't have a code and there were errors
      if (!determinedAffiliateCode && currentUser.email && (roleError || affiliateError)) {
        determinedAffiliateCode = getAffiliateCodeFromEmail(currentUser.email);
        if (determinedAffiliateCode) {
          console.log("AuthContext: Final fallback - assigned affiliate code based on email:", determinedAffiliateCode);
        }
      }
      
      console.log("AuthContext: Building final user object...");
      const finalUser: UserWithRole = {
        ...currentUser,
        role: roleData === 'admin' ? 'admin' : 'affiliate',
        affiliateCode: determinedAffiliateCode,
        name: profileData?.full_name || profileData?.display_name || currentUser.email?.split('@')[0] || "User"
      };
      
      console.log("AuthContext: Final user object prepared:", finalUser);
      return finalUser;

    } catch (err: any) {
      console.error("AuthContext: Critical error in fetchUserData for user ID " + userId + ":", err.message);
      console.error("AuthContext: Full error object:", err);
      
      // Enhanced fallback user object with more reliable affiliate code assignment
      const fallbackAffiliateCode = currentUser.user_metadata?.affiliate_code || 
                                  (currentUser.email ? getAffiliateCodeFromEmail(currentUser.email) : undefined);
      
      const fallbackUser = { 
          ...currentUser, 
          role: 'affiliate' as AppRole, // Default role
          affiliateCode: fallbackAffiliateCode, 
          name: currentUser.email?.split('@')[0] || "User"
      };
      console.log("AuthContext: Returning enhanced fallback user object:", fallbackUser);
      return fallbackUser;
    }
  };

  // Simplified auth state management
  useEffect(() => {
    console.log("AuthContext: Initializing auth state listener and session check.");
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("AuthContext: Auth state changed. Event:", event, "Session exists:", !!newSession);
        setSession(newSession);

        if (newSession?.user) {
          console.log("AuthContext: User found in session:", newSession.user.email);
          setIsLoading(true);
          try {
            const detailedUser = await fetchUserData(newSession.user.id, newSession.user);
            console.log("AuthContext: fetchUserData completed successfully:", detailedUser);
            setUser(detailedUser);
            setIsAdmin(detailedUser.role === 'admin');
          } catch (error) {
            console.error("AuthContext: Error in fetchUserData:", error);
            // Set a more robust minimal user to prevent infinite loading
            const fallbackAffiliateCode = newSession.user.user_metadata?.affiliate_code || 
                                        (newSession.user.email ? getAffiliateCodeFromEmail(newSession.user.email) : undefined);
            
            setUser({
              ...newSession.user,
              role: 'affiliate',
              affiliateCode: fallbackAffiliateCode,
              name: newSession.user.email?.split('@')[0] || "User"
            });
            setIsAdmin(false);
          }
        } else {
          console.log("AuthContext: No user in session. Clearing user state.");
          setUser(null);
          setIsAdmin(false);
        }
        setIsLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      console.log("AuthContext: Initial getSession complete. Session exists:", !!existingSession);
      if (!existingSession) {
        setIsLoading(false);
      }
      // onAuthStateChange will handle the session if it exists
    }).catch((err) => {
        console.error("AuthContext: Error during initial getSession:", err);
        setIsLoading(false);
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
        console.log("AuthContext: Unsubscribed from auth state changes.");
      }
    };
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
