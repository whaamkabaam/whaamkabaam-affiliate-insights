
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

  const fetchUserData = async (userId: string, currentUser: User): Promise<UserWithRole> => {
    try {
      console.log("AuthContext: Fetching additional user data for:", userId);

      const [roleResult, affiliateResult, profileResult] = await Promise.all([
        supabase.rpc('get_user_role', { user_id: userId }),
        supabase.rpc('get_affiliate_data', { user_id: userId }),
        supabase.from('profiles').select('full_name, display_name').eq('id', userId).maybeSingle()
      ]);

      const { data: roleData, error: roleError } = roleResult;
      const { data: affiliateRpcData, error: affiliateError } = affiliateResult;
      const { data: profileData, error: profileError } = profileResult;

      if (roleError) console.error("AuthContext: Error checking admin role:", roleError);
      if (affiliateError) console.error("AuthContext: Error fetching affiliate data from RPC:", affiliateError);
      if (profileError) console.error("AuthContext: Error fetching profile data:", profileError);

      console.log("AuthContext: User role data from RPC:", roleData);
      console.log("AuthContext: Affiliate data from RPC:", affiliateRpcData);
      console.log("AuthContext: Profile data from DB:", profileData);

      let determinedAffiliateCode: string | undefined = currentUser.user_metadata?.affiliate_code;

      if (!determinedAffiliateCode && affiliateRpcData && typeof affiliateRpcData === 'object' && 'affiliate_code' in affiliateRpcData && (affiliateRpcData as any).affiliate_code) {
        determinedAffiliateCode = (affiliateRpcData as { affiliate_code: string }).affiliate_code;
        console.log("AuthContext: Affiliate code from RPC:", determinedAffiliateCode);
      }

      if (!determinedAffiliateCode && currentUser.email) {
        const emailLower = currentUser.email.toLowerCase();
        if (emailLower === 'nic@whaamkabaam.com') {
          determinedAffiliateCode = 'nic';
          console.log("AuthContext: Assigned fallback affiliate code 'nic' based on email");
        } else if (emailLower === 'maru@whaamkabaam.com') {
          determinedAffiliateCode = 'maru';
          console.log("AuthContext: Assigned fallback affiliate code 'maru' based on email");
        }
      }
      
      const finalUser: UserWithRole = {
        ...currentUser,
        role: roleData === 'admin' ? 'admin' : 'affiliate',
        affiliateCode: determinedAffiliateCode,
        name: profileData?.full_name || profileData?.display_name || currentUser.email?.split('@')[0] || undefined
      };
      
      setIsAdmin(finalUser.role === 'admin');
      console.log("AuthContext: Final user object prepared:", finalUser);
      return finalUser;

    } catch (err) {
      console.error("AuthContext: Error in fetchUserData:", err);
      return { ...currentUser, role: 'affiliate', affiliateCode: currentUser.user_metadata?.affiliate_code, name: currentUser.email?.split('@')[0] };
    }
  };

  useEffect(() => {
    console.log("AuthContext: Setting up auth state listener.");
    setIsLoading(true);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("AuthContext: Auth state changed, event:", event, "session exists:", !!newSession);
        setSession(newSession);

        if (newSession?.user) {
          console.log("AuthContext: User in new session:", newSession.user.email);
          const detailedUser = await fetchUserData(newSession.user.id, newSession.user);
          setUser(detailedUser);
        } else {
          console.log("AuthContext: No user in new session.");
          setUser(null);
          setIsAdmin(false);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      console.log("AuthContext: Checking for existing session", !!existingSession);
      if (existingSession?.user) {
        console.log("AuthContext: Found existing session for user:", existingSession.user.email);
        if (!user || user.id !== existingSession.user.id) {
          const detailedUser = await fetchUserData(existingSession.user.id, existingSession.user);
          setUser(detailedUser);
        }
        setSession(existingSession);
      } else {
        console.log("AuthContext: No existing session found.");
        setUser(null);
        setIsAdmin(false);
      }
      setIsLoading(false);
    }).catch((err) => {
        console.error("AuthContext: Error getting session:", err);
        setIsLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      console.log("AuthContext: Unsubscribed from auth state changes.");
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`AuthContext: Attempting to sign in with email: ${email}`);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        console.error("AuthContext: Login error:", signInError);
        setError(signInError.message || "Login failed");
        throw signInError;
      }
      
      console.log("AuthContext: Login successful, data object:", data);
      return { user: data.user, session: data.session, weakPassword: (data as any).weakPassword };

    } catch (err: any) {
      console.error("AuthContext: Login exception:", err);
      if (email === "admin@whaamkabaam.com" && password === "AdminTest123") {
        try {
          console.log("AuthContext: Attempting to initialize users via edge function due to admin login fail...");
          const { data: initData, error: initError } = await supabase.functions.invoke<any>("setup-initial-users");
          
          if (initError) console.error("AuthContext: Error initializing users:", initError);
          else if (initData) {
            console.log("AuthContext: Users initialized:", initData);
            toast.info("Test users may have been (re)initialized. Please try logging in again.");
          }
        } catch (initErr) {
          console.error("AuthContext: Error during user initialization call:", initErr);
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
      console.error("AuthContext: Logout error:", err.message);
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
    isAuthenticated: !!user && !!session,
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
