
import { cn } from "@/lib/utils";
import { CalendarIcon, LineChartIcon, UsersIcon, SettingsIcon, HomeIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <div className={cn("pb-12 bg-sidebar text-sidebar-foreground w-64 flex-shrink-0 border-r border-sidebar-border", className)} {...props}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <NavLink 
              to="/dashboard"
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-sidebar-accent",
                  isActive && "bg-sidebar-accent/10 text-sidebar-accent"
                )
              }
            >
              <HomeIcon className="h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink 
              to="/dashboard/analytics"
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-sidebar-accent",
                  isActive && "bg-sidebar-accent/10 text-sidebar-accent"
                )
              }
            >
              <LineChartIcon className="h-4 w-4" />
              <span>Analytics</span>
            </NavLink>
            <NavLink 
              to="/dashboard/customers"
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-sidebar-accent",
                  isActive && "bg-sidebar-accent/10 text-sidebar-accent"
                )
              }
            >
              <UsersIcon className="h-4 w-4" />
              <span>Customers</span>
            </NavLink>
            <NavLink 
              to="/dashboard/calendar"
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-sidebar-accent", 
                  isActive && "bg-sidebar-accent/10 text-sidebar-accent"
                )
              }
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Calendar</span>
            </NavLink>
            <NavLink 
              to="/dashboard/settings"
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-sidebar-accent",
                  isActive && "bg-sidebar-accent/10 text-sidebar-accent"
                )
              }
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
