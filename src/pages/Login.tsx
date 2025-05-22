
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { InitializeUsers } from "@/components/InitializeUsers";
import { AlertCircle } from "lucide-react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black to-gray-900 p-4">
      {/* Add a decorative background with pointer-events-none to ensure it doesn't interfere with form interaction */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-red/20 to-transparent opacity-20 pointer-events-none" />
      
      {/* Set z-index to ensure form elements are on top and interactive */}
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6 rounded shadow-sm">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
            <p className="text-sm text-yellow-700">
              <strong>Demo Mode:</strong> Use the credentials below or click "Initialize Users" to create test accounts.
            </p>
          </div>
        </div>
        
        <LoginForm />
        <InitializeUsers isLoginPage={true} />
      </div>
      
      {/* Help message for demo users */}
      <div className="mt-8 text-white opacity-80 text-center max-w-md p-4 bg-black/30 rounded-lg border border-white/10 backdrop-blur-sm">
        <p className="text-sm">
          <strong>Demo Credentials:</strong><br />
          Email: admin@whaamkabaam.com<br />
          Password: AdminTest123
        </p>
        <p className="mt-2 text-xs text-white/70">
          If you encounter login issues, click "Initialize Users" button below the form to reset the test accounts.
        </p>
      </div>
    </div>
  );
}
