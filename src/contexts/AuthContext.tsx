
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

  // Helper function to create a promise with timeout
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };

  // Replace the existing fetchUserData function with this one:
  const fetchUserData = async (userId: string, currentUser: User): Promise<UserWithRole> => {
    try {
      console.log("AuthContext: Starting fetchUserData for userId:", userId);

      // Perform all data fetching operations concurrently with timeout
      console.log("AuthContext: Making concurrent RPC calls...");
      
      // Convert Supabase builders to promises by calling them
      const rolePromise = withTimeout(
        supabase.rpc('get_user_role', { user_id: userId }),
        10000,
        'get_user_role'
      );
      
      const affiliatePromise = withTimeout(
        supabase.rpc('get_affiliate_data', { p_user_id: userId }),
        10000,
        'get_affiliate_data'
      );
      
      const profilePromise = withTimeout(
        supabase.from('profiles').select('full_name, display_name').eq('id', userId).maybeSingle(),
        10000,
        'profiles_query'
      );

      console.log("AuthContext: Waiting for all promises to resolve...");
      
      // Track individual promise completion
      let roleResult, affiliateResult, profileResult;
      
      try {
        console.log("AuthContext: Starting role promise...");
        roleResult = await rolePromise;
        console.log("AuthContext: Role promise completed:", roleResult);
      } catch (error) {
        console.error("AuthContext: Role promise failed:", error);
        roleResult = { data: null, error };
      }

      try {
        console.log("AuthContext: Starting affiliate promise...");
        affiliateResult = await affiliatePromise;
        console.log("AuthContext: Affiliate promise completed:", affiliateResult);
      } catch (error) {
        console.error("AuthContext: Affiliate promise failed:", error);
        affiliateResult = { data: null, error };
      }

      try {
        console.log("AuthContext: Starting profile promise...");
        profileResult = await profilePromise;
        console.log("AuthContext: Profile promise completed:", profileResult);
      } catch (error) {
        console.error("AuthContext: Profile promise failed:", error);
        profileResult = { data: null, error };
      }

      console.log("AuthContext: All promises resolved. Processing results...");

      const { data: roleData, error: roleError } = roleResult;
      const { data: affiliateRpcData, error: affiliateError } = affiliateResult;
      const { data: profileData, error: profileError } = profileResult;

      // Log any errors encountered during fetching
      if (roleError) console.error("AuthContext: Error checking admin role:", roleError.message);
      if (affiliateError) console.error("AuthContext: Error fetching affiliate data from RPC:", affiliateError.message);
      if (profileError) console.error("AuthContext: Error fetching profile data:", profileError.message);

      console.log("AuthContext: User role data from RPC:", roleData);
      console.log("AuthContext: Affiliate data from RPC (get_affiliate_data):", affiliateRpcData);
      console.log("AuthContext: Profile data from DB:", profileData);

      let determinedAffiliateCode: string | undefined = currentUser.user_metadata?.affiliate_code;
      console.log("AuthContext: Initial affiliate code from user_metadata:", determinedAffiliateCode);

      // Try to get affiliate_code from the RPC call's result
      if (!determinedAffiliateCode && affiliateRpcData && typeof affiliateRpcData === 'object' && 'affiliate_code' in affiliateRpcData) {
        const rpcAffiliateCode = (affiliateRpcData as { affiliate_code?: string }).affiliate_code;
        if (rpcAffiliateCode) {
          determinedAffiliateCode = rpcAffiliateCode;
          console.log("AuthContext: Affiliate code from RPC (get_affiliate_data):", determinedAffiliateCode);
        }
      }

      // Fallback logic if no affiliate code is found yet (important for Maru as per logs)
      if (!determinedAffiliateCode && currentUser.email) {
        const emailLower = currentUser.email.toLowerCase();
        console.log("AuthContext: Checking email-based fallbacks for:", emailLower);
        if (emailLower === 'nic@whaamkabaam.com') {
          determinedAffiliateCode = 'nic';
          console.log("AuthContext: Assigned FALLBACK affiliate code 'nic' based on email");
        } else if (emailLower === 'maru@whaamkabaam.com') {
          determinedAffiliateCode = 'maru';
          console.log("AuthContext: Assigned FALLBACK affiliate code 'maru' based on email");
        }
        // Add other fallbacks if necessary, e.g. for 'ayoub' if his RPC also fails
        // else if (emailLower === 'ayoub@whaamkabaam.com') {
        //   determinedAffiliateCode = 'ayoub';
        //   console.log("AuthContext: Assigned FALLBACK affiliate code 'ayoub' based on email");
        // }
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
      // Fallback to a minimal user object in case of unexpected errors
      const fallbackUser = { 
          ...currentUser, 
          role: 'affiliate' as AppRole, // Default role
          affiliateCode: currentUser.user_metadata?.affiliate_code, 
          name: currentUser.email?.split('@')[0] || "User"
      };
      console.log("AuthContext: Returning fallback user object:", fallbackUser);
      return fallbackUser;
    }
  };

  // Replace your main useEffect for auth state changes and session loading with this:
  useEffect(() => {
    console.log("AuthContext: Initializing auth state listener and session check.");
    setIsLoading(true); // Start with loading true

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("AuthContext: Auth state changed. Event:", event, "Session exists:", !!newSession);
        setSession(newSession); // Update session state regardless

        if (newSession?.user) {
          console.log("AuthContext: User found in new/changed session:", newSession.user.email);
          try {
            const detailedUser = await fetchUserData(newSession.user.id, newSession.user);
            console.log("AuthContext: fetchUserData completed successfully:", detailedUser);
            setUser(detailedUser);
            setIsAdmin(detailedUser.role === 'admin'); // Set isAdmin based on fetched data
          } catch (error) {
            console.error("AuthContext: Error in fetchUserData:", error);
            // Set a minimal user to prevent infinite loading
            setUser({
              ...newSession.user,
              role: 'affiliate',
              affiliateCode: newSession.user.user_metadata?.affiliate_code,
              name: newSession.user.email?.split('@')[0] || "User"
            });
            setIsAdmin(false);
          }
        } else {
          console.log("AuthContext: No user in new/changed session. Clearing user state.");
          setUser(null);
          setIsAdmin(false);
        }
        setIsLoading(false); // Finish loading after processing
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      console.log("AuthContext: Initial getSession complete. Session exists:", !!existingSession);
      // No need to set session again if onAuthStateChange already handled it, but good for initial load
      if (existingSession) {
          setSession(existingSession); // Set session if found
          if (existingSession.user) {
              console.log("AuthContext: User found in existing session:", existingSession.user.email);
               // Only set user if not already set by onAuthStateChange or if different user
              if (!user || user.id !== existingSession.user.id) {
                  try {
                    const detailedUser = await fetchUserData(existingSession.user.id, existingSession.user);
                    console.log("AuthContext: Initial session fetchUserData completed:", detailedUser);
                    setUser(detailedUser);
                    setIsAdmin(detailedUser.role === 'admin');
                  } catch (error) {
                    console.error("AuthContext: Error in initial fetchUserData:", error);
                    // Set a minimal user to prevent infinite loading
                    setUser({
                      ...existingSession.user,
                      role: 'affiliate',
                      affiliateCode: existingSession.user.user_metadata?.affiliate_code,
                      name: existingSession.user.email?.split('@')[0] || "User"
                    });
                    setIsAdmin(false);
                  }
              }
          } else { // existingSession but no user object
              setUser(null);
              setIsAdmin(false);
          }
      } else { // No existing session
        setUser(null);
        setIsAdmin(false);
      }
      setIsLoading(false); // Finish loading after initial check
    }).catch((err) => {
        console.error("AuthContext: Error during initial getSession:", err);
        setIsLoading(false); // Ensure loading is false on error too
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
        console.log("AuthContext: Unsubscribed from auth state changes.");
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

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
