
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "./Logo";
import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Login successful");
    } catch (err) {
      // Error is handled in the AuthContext
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  return (
    <Card className="w-full max-w-md bg-card shadow-lg">
      <CardHeader className="space-y-2 items-center text-center">
        <div className="flex justify-center mb-2">
          <Logo size="large" />
        </div>
        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-brand-red to-brand-yellow bg-clip-text text-transparent">
          WhaamKabaam
        </CardTitle>
        <CardDescription className="text-lg">
          Affiliate Dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              required
              placeholder="email@whaamkabaam.com"
              autoComplete="email"
              className="focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <a href="#" className="text-xs text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-brand-red hover:bg-brand-red/90 text-white" 
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Log In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        <p>Welcome to the WhaamKabaam Affiliate Program</p>
      </CardFooter>
    </Card>
  );
}
