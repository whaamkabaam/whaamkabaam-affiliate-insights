
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // All authenticated users go to regular dashboard
        // They can access admin features via navigation if they're admin
        navigate("/dashboard");
      } else {
        // Not authenticated, redirect to login
        navigate("/login");
      }
    }
  }, [navigate, isAuthenticated, isAdmin, isLoading]);

  // Show loading while authentication state is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
};

export default Index;
