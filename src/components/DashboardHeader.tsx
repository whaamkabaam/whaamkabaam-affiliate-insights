import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
export function DashboardHeader() {
  const {
    user,
    logout
  } = useAuth();
  return <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex gap-3 items-center font-semibold">
        <Logo size="small" />
        <span className="text-xl font-bold bg-gradient-to-r from-brand-red to-brand-yellow bg-clip-text text-transparent">
          WhaamKabaam
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:flex gap-2 text-right">
          <div className="font-semibold">{user?.name || user?.email}</div>
          {user?.affiliateCode}
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>;
}