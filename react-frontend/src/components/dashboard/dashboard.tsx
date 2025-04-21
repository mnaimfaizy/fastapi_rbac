import { useState } from "react";
import { Sidebar } from "./sidebar";
import { StatsCard } from "./stats-card";
import { OverviewChart } from "./overview-chart";
import { DataTable } from "./data-table";
import { Button } from "@/components/ui/button";
import { Users, ShieldCheck, UserCheck, BarChart, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Sample data
const chartData = [
  { name: "Jan", total: 1200 },
  { name: "Feb", total: 2100 },
  { name: "Mar", total: 1800 },
  { name: "Apr", total: 2400 },
  { name: "May", total: 2800 },
  { name: "Jun", total: 2600 },
  { name: "Jul", total: 3200 },
];

const sampleUsers = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@example.com",
    role: "Admin",
    status: "active" as const,
    lastActive: "Just now",
  },
  {
    id: "2",
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    role: "Editor",
    status: "active" as const,
    lastActive: "2 hours ago",
  },
  {
    id: "3",
    name: "Robert Brown",
    email: "robert.brown@example.com",
    role: "Viewer",
    status: "inactive" as const,
    lastActive: "3 days ago",
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma.wilson@example.com",
    role: "Editor",
    status: "pending" as const,
    lastActive: "1 hour ago",
  },
  {
    id: "5",
    name: "Michael Davis",
    email: "michael.davis@example.com",
    role: "Viewer",
    status: "active" as const,
    lastActive: "5 hours ago",
  },
];

export function Dashboard() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <div className="flex min-h-screen">
      {isDesktop ? (
        <div
          className={cn(
            "border-r bg-background",
            isCollapsed ? "w-[80px]" : "w-[250px]"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b px-4">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold">RBAC Admin</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn("ml-auto", !isCollapsed && "rotate-180")}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <Sidebar isCollapsed={isCollapsed} />
        </div>
      ) : (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-4 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] p-0">
            <div className="flex h-16 items-center border-b px-4">
              <h2 className="text-lg font-semibold">RBAC Admin</h2>
            </div>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center gap-2">
            <Button>Download Report</Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Users"
            value="3,456"
            description="Last 30 days"
            trend={{ value: 12, isPositive: true }}
            icon={Users}
          />
          <StatsCard
            title="Roles"
            value="12"
            description="3 added this month"
            trend={{ value: 5, isPositive: true }}
            icon={UserCheck}
          />
          <StatsCard
            title="Permissions"
            value="54"
            description="No change"
            icon={ShieldCheck}
          />
          <StatsCard
            title="Active Sessions"
            value="213"
            description="10% decrease"
            trend={{ value: 10, isPositive: false }}
            icon={BarChart}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <OverviewChart
            title="User Activity"
            description="Daily active users over time"
            data={chartData}
            className="col-span-4"
          />
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Logins</CardTitle>
              <CardDescription>
                The most recent user login activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sampleUsers.slice(0, 3).map((user) => (
                  <div key={user.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={cn(
                          user.status === "active" &&
                            "bg-green-100 text-green-800"
                        )}
                      >
                        {user.lastActive}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-tight mb-4">
            System Users
          </h3>
          <DataTable data={sampleUsers} />
        </div>
      </div>
    </div>
  );
}

// Import these components here since we're using them inline only in this component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
