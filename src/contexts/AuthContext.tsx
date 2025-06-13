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

  // Enhanced email-based mapping for known users
  const getKnownUserData = (email: string): { affiliateCode: string; role: AppRole; name: string } | null => {
    const emailLower = email.toLowerCase();
    const knownUsers: Record<string, { affiliateCode: string; role: AppRole; name: string }> = {
      'admin@whaamkabaam.com': { affiliateCode: 'admin', role: 'admin', name: 'Admin' },
      'nic@whaamkabaam.com': { affiliateCode: 'nic', role: 'affiliate', name: 'Nic' },
      'maru@whaamkabaam.com': { affiliateCode: 'maru', role: 'affiliate', name: 'Maru' },
      'ayoub@whaamkabaam.com': { affiliateCode: 'ayoub', role: 'affiliate', name: 'Ayoub' },
      'tg@whaamkabaam.com': { affiliateCode: 'TG', role: 'affiliate', name: 'TweakingGuy' }
    };
    return knownUsers[emailLower] || null;
  };

  // Simplified and faster user data fetching
  const fetchUserData = async (userId: string, currentUser: User): Promise<UserWithRole> => {
    try {
      // Check if this is a known user first
      const knownUserData = currentUser.email ? getKnownUserData(currentUser.email) : null;
      
      if (knownUserData) {
        const finalUser: UserWithRole = {
          ...currentUser,
          role: knownUserData.role,
          affiliateCode: knownUserData.affiliateCode,
          name: knownUserData.name
        };
        return finalUser;
      }

      // For unknown users, try a simplified direct query approach with very short timeout
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
          // Only admin@whaamkabaam.com should be admin
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
        // Silent fallback for production
      }

      // Final fallback for unknown users
      const fallbackUser: UserWithRole = {
        ...currentUser,
        role: 'affiliate',
        affiliateCode: undefined, // No affiliate code for unknown users
        name: currentUser.email?.split('@')[0] || "User"
      };
      
      return fallbackUser;

    } catch (err: any) {
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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (newSession?.user) {
          setIsLoading(true);
          try {
            const detailedUser = await fetchUserData(newSession.user.id, newSession.user);
            setUser(detailedUser);
            // Only set isAdmin true for admin@whaamkabaam.com
            const adminStatus = detailedUser.role === 'admin' && detailedUser.email?.toLowerCase() === 'admin@whaamkabaam.com';
            setIsAdmin(adminStatus);
          } catch (error) {
            // Set a robust minimal user
            const knownUserData = newSession.user.email ? getKnownUserData(newSession.user.email) : null;
            
            const fallbackUser = {
              ...newSession.user,
              role: knownUserData?.role || 'affiliate',
              affiliateCode: knownUserData?.affiliateCode,
              name: knownUserData?.name || newSession.user.email?.split('@')[0] || "User"
            };
            
            setUser(fallbackUser);
            // Only admin@whaamkabaam.com is admin
            const adminStatus = knownUserData?.role === 'admin' && newSession.user.email?.toLowerCase() === 'admin@whaamkabaam.com';
            setIsAdmin(adminStatus);
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }
        setIsLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!existingSession) {
        setIsLoading(false);
      }
      // onAuthStateChange will handle the session if it exists
    }).catch((err) => {
        setIsLoading(false);
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        setError(error.message || "Login failed");
        throw error;
      }
      
      return data;
    } catch (err: any) {
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
