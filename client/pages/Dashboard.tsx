import { Layout } from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart3,
  Clock,
  Users,
  List,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();

  const stats = [
    {
      label: "Team Members",
      value: "5",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Lines Queued",
      value: "24",
      icon: List,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Claimed Today",
      value: "12",
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Claim Cooldown",
      value: "5m",
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const quickLinks = isAdmin
    ? [
        {
          title: "Numbers Sorter",
          description: "Add and deduplicate numbers",
          icon: BarChart3,
          path: "/sorter",
        },
        {
          title: "Queued List",
          description: "Manage queued numbers",
          icon: List,
          path: "/queued",
        },
        {
          title: "Team Management",
          description: "Manage team members",
          icon: Users,
          path: "/settings",
        },
      ]
    : [
        {
          title: "Numbers Inbox",
          description: "Claim your numbers",
          icon: Clock,
          path: "/inbox",
        },
        {
          title: "Team Chat",
          description: "Connect with your team",
          icon: Users,
          path: "/chat",
        },
        {
          title: "History",
          description: "View your claimed numbers",
          icon: TrendingUp,
          path: "/history",
        },
      ];

  return (
    <Layout>
      <div className="min-h-screen p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Manage your team and track your numbers"
                : "Check your inbox and collaborate with your team"}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={index}
                  className="border-border/50 hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          {stat.label}
                        </span>
                        <div className={`${stat.bgColor} p-2 rounded-lg`}>
                          <Icon className={`h-4 w-4 ${stat.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Quick Access
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.path} to={link.path}>
                    <Card className="border-border/50 hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group h-full">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {link.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {link.description}
                              </p>
                            </div>
                            <Icon className="h-6 w-6 text-primary/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </div>
                          <div className="flex items-center gap-2 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Go to {link.title}
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your team's recent actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isAdmin ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recent activity yet</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Claim some numbers to see your activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
