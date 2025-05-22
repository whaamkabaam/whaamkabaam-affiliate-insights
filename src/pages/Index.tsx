
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Redirect admins to admin dashboard, others to regular dashboard
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } else {
      // Not authenticated, redirect to login
      navigate("/login");
    }
  }, [navigate, isAuthenticated, isAdmin]);

  return null;
};

export default Index;
