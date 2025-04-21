import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Settings,
  Lock,
  ShieldCheck,
  UserCheck,
  LogOut,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean;
}

export function Sidebar({ className, isCollapsed = false }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2
            className={cn(
              "text-lg font-semibold tracking-tight",
              isCollapsed && "text-center"
            )}
          >
            {!isCollapsed && "Dashboard"}
          </h2>

          <div className={cn("space-y-1 pt-2")}>
            <Button
              variant={isActive("/dashboard") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/dashboard">
                <LayoutDashboard
                  className={cn("h-5 w-5", !isCollapsed && "mr-2")}
                />
                {!isCollapsed && "Overview"}
              </Link>
            </Button>

            <Button
              variant={isActive("/users") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/users">
                <Users className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Users"}
              </Link>
            </Button>

            <Button
              variant={isActive("/roles") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/roles">
                <UserCheck className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Roles"}
              </Link>
            </Button>

            <Button
              variant={isActive("/permissions") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/permissions">
                <ShieldCheck
                  className={cn("h-5 w-5", !isCollapsed && "mr-2")}
                />
                {!isCollapsed && "Permissions"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="px-4 py-2">
          <h2
            className={cn(
              "text-lg font-semibold tracking-tight",
              isCollapsed && "text-center"
            )}
          >
            {!isCollapsed && "Settings"}
          </h2>
          <div className="space-y-1 pt-2">
            <Button
              variant={isActive("/settings") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/settings">
                <Settings className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                {!isCollapsed && "General"}
              </Link>
            </Button>

            <Button
              variant={isActive("/security") ? "secondary" : "ghost"}
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/security">
                <Lock className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Security"}
              </Link>
            </Button>

            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100/20",
                isCollapsed && "justify-center"
              )}
              asChild
            >
              <Link to="/logout">
                <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Logout"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
