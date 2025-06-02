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

  // Enhanced email-based mapping for known users - ONLY admin@whaamkabaam.com is admin
  const getKnownUserData = (email: string): { affiliateCode: string; role: AppRole; name: string } | null => {
    const emailLower = email.toLowerCase();
    const knownUsers: Record<string, { affiliateCode: string; role: AppRole; name: string }> = {
      'admin@whaamkabaam.com': { affiliateCode: 'admin', role: 'admin', name: 'Admin' },
      'nic@whaamkabaam.com': { affiliateCode: 'nic', role: 'affiliate', name: 'Nic' },
      'maru@whaamkabaam.com': { affiliateCode: 'maru', role: 'affiliate', name: 'Maru' },
      'ayoub@whaamkabaam.com': { affiliateCode: 'ayoub', role: 'affiliate', name: 'Ayoub' }
    };
    return knownUsers[emailLower] || null;
  };

  // Simplified and faster user data fetching
  const fetchUserData = async (userId: string, currentUser: User): Promise<UserWithRole> => {
    try {
      console.log("AuthContext: Starting fetchUserData for userId:", userId);
      
      // Check if this is a known user first
      const knownUserData = currentUser.email ? getKnownUserData(currentUser.email) : null;
      
      if (knownUserData) {
        console.log("AuthContext: Using known user data for:", currentUser.email);
        const finalUser: UserWithRole = {
          ...currentUser,
          role: knownUserData.role,
          affiliateCode: knownUserData.affiliateCode,
          name: knownUserData.name
        };
        console.log("AuthContext: Final user object prepared (known user):", finalUser);
        return finalUser;
      }

      // For unknown users, try a simplified direct query approach with very short timeout
      console.log("AuthContext: Unknown user, attempting simplified queries...");
      
      try {
        // Try a simple direct query to affiliates table with 1 second timeout
        const affiliateQuery = supabase
          .from('affiliates')
          .select('affiliate_code, commission_rate')
          .eq('user_id', userId)
          .maybeSingle();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 1000)
        );

        const { data: affiliateData } = await Promise.race([affiliateQuery, timeoutPromise]) as any;
        
        if (affiliateData) {
          console.log("AuthContext: Found affiliate data via direct query:", affiliateData);
          // CRITICAL FIX: Only admin@whaamkabaam.com should be admin
          const isUserAdmin = currentUser.email?.toLowerCase() === 'admin@whaamkabaam.com';
          const finalUser: UserWithRole = {
            ...currentUser,
            role: isUserAdmin ? 'admin' : 'affiliate',
            affiliateCode: affiliateData.affiliate_code,
            name: currentUser.email?.split('@')[0] || "User"
          };
          return finalUser;
        }
      } catch (queryError) {
        console.warn("AuthContext: Direct query failed:", queryError);
      }

      // Final fallback for unknown users
      console.log("AuthContext: Using complete fallback for unknown user");
      const fallbackUser: UserWithRole = {
        ...currentUser,
        role: 'affiliate',
        affiliateCode: undefined, // No affiliate code for unknown users
        name: currentUser.email?.split('@')[0] || "User"
      };
      
      return fallbackUser;

    } catch (err: any) {
      console.error("AuthContext: Critical error in fetchUserData:", err);
      
      // Emergency fallback
      const emergencyUser: UserWithRole = {
        ...currentUser,
        role: 'affiliate',
        affiliateCode: currentUser.email ? getKnownUserData(currentUser.email)?.affiliateCode : undefined,
        name: currentUser.email?.split('@')[0] || "User"
      };
      
      return emergencyUser;
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
            // CRITICAL FIX: Only set isAdmin true for admin@whaamkabaam.com
            const adminStatus = detailedUser.role === 'admin' && detailedUser.email?.toLowerCase() === 'admin@whaamkabaam.com';
            setIsAdmin(adminStatus);
            console.log("AuthContext: Setting isAdmin to:", adminStatus, "for user:", detailedUser.email);
          } catch (error) {
            console.error("AuthContext: Error in fetchUserData:", error);
            // Set a robust minimal user
            const knownUserData = newSession.user.email ? getKnownUserData(newSession.user.email) : null;
            
            const fallbackUser = {
              ...newSession.user,
              role: knownUserData?.role || 'affiliate',
              affiliateCode: knownUserData?.affiliateCode,
              name: knownUserData?.name || newSession.user.email?.split('@')[0] || "User"
            };
            
            setUser(fallbackUser);
            // CRITICAL FIX: Only admin@whaamkabaam.com is admin
            const adminStatus = knownUserData?.role === 'admin' && newSession.user.email?.toLowerCase() === 'admin@whaamkabaam.com';
            setIsAdmin(adminStatus);
            console.log("AuthContext: Fallback setting isAdmin to:", adminStatus, "for user:", newSession.user.email);
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
