
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { InitializeUsers } from "@/components/InitializeUsers";
import { AlertCircle, HelpCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
        <Alert className="bg-yellow-100 border-l-4 border-yellow-500 mb-6 shadow-sm">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <AlertTitle className="text-yellow-800 font-medium">Demo Mode</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Click "Initialize Users" below to create test accounts before logging in.
          </AlertDescription>
        </Alert>
        
        <LoginForm />
        <InitializeUsers isLoginPage={true} />
      </div>
      
      {/* Help message for demo users */}
      <div className="mt-8 text-white opacity-80 text-center max-w-md p-4 bg-black/30 rounded-lg border border-white/10 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <HelpCircle className="h-5 w-5" />
          <h3 className="font-medium">Demo Credentials</h3>
        </div>
        <p className="text-sm mb-2">
          <strong>Admin:</strong> admin@whaamkabaam.com / AdminTest123<br />
          <strong>Nic:</strong> nic@whaamkabaam.com / Test1234!<br />
          <strong>Ayoub:</strong> ayoub@whaamkabaam.com / AyoubTest123
        </p>
        <div className="flex items-center justify-center text-xs text-amber-300">
          <Info className="h-3 w-3 mr-1" />
          <span>Be sure to initialize users before attempting to log in</span>
        </div>
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs bg-white/10 hover:bg-white/20 border-white/20"
            onClick={() => {
              navigator.clipboard.writeText('admin@whaamkabaam.com\nAdminTest123');
            }}
          >
            Copy Admin
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs bg-white/10 hover:bg-white/20 border-white/20"
            onClick={() => {
              navigator.clipboard.writeText('nic@whaamkabaam.com\nTest1234!');
            }}
          >
            Copy Nic
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs bg-white/10 hover:bg-white/20 border-white/20"
            onClick={() => {
              navigator.clipboard.writeText('ayoub@whaamkabaam.com\nAyoubTest123');
            }}
          >
            Copy Ayoub
          </Button>
        </div>
      </div>
    </div>
  );
}
