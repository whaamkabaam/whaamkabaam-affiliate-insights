
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name?: string;
  affiliateCode: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration purposes
const MOCK_USERS = [
  {
    id: "1",
    email: "nic@example.com",
    password: "password123",
    name: "Nicolas",
    affiliateCode: "nic",
  },
  {
    id: "2",
    email: "maru@example.com",
    password: "password123",
    name: "Maru",
    affiliateCode: "maru",
  },
  {
    id: "3",
    email: "ayoub@example.com",
    password: "password123",
    name: "Ayoub",
    affiliateCode: "ayoub",
  },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on load
  useEffect(() => {
    const savedUser = localStorage.getItem("whaamkabaam_user");
    
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to parse user from localStorage", err);
        localStorage.removeItem("whaamkabaam_user");
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Mock authentication - in production, this would be a real API call
      const user = MOCK_USERS.find(
        (u) => u.email === email && u.password === password
      );
      
      if (!user) {
        throw new Error("Invalid email or password");
      }
      
      const { password: _, ...userWithoutPassword } = user;
      setUser(userWithoutPassword);
      localStorage.setItem("whaamkabaam_user", JSON.stringify(userWithoutPassword));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("whaamkabaam_user");
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
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
