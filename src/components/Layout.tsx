import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  Home,
  Users,
  Settings,
  BadgeDollarSign,
  ChartPie,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import ConnectWallet from "@/components/ConnectWallet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EthBalance } from "@coinbase/onchainkit/identity";
import { useAccount, useDisconnect } from "wagmi";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, disconnectUser } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Force re-render when connection state changes
  useEffect(() => {
    // This effect will run whenever isConnected changes
    // helping ensure the UI updates appropriately
  }, [isConnected]);

  // Handle disconnect button click
  const handleDisconnect = () => {
    // First disconnect from wallet provider
    disconnect();
    // Then update app state
    disconnectUser();
    // Navigate to home page
    navigate("/", { replace: true });
  };

  const NavItem = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
  }) => (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-all hover:bg-accent",
        location.pathname === to ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  return (
    <div className="flex min-h-screen bg-mesh-gradient">
      {isAuthenticated && (
        <aside
          className={cn(
            "fixed left-0 top-0 z-30 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
            isCollapsed ? "w-[60px]" : "w-[240px]"
          )}
        >
          <div className="flex h-16 items-center justify-between px-3 border-b">
            {!isCollapsed && (
              <Link to="/" className="flex items-center gap-2 font-bold text-lg">
                <BadgeDollarSign className="h-6 w-6 text-base-blue" />
                <span className="text-base-blue">SplitBase</span>
              </Link>
            )}
            {isCollapsed && (
              <Link to="/" className="flex items-center justify-center w-full">
                <BadgeDollarSign className="h-6 w-6 text-base-blue" />
              </Link>
            )}
          </div>
          
          <div className="flex flex-col gap-1 p-2 flex-1">
            <NavItem to="/" icon={Home} label="Dashboard" />
            <NavItem to="/groups" icon={Users} label="Groups" />
            <NavItem to="/expenses" icon={BadgeDollarSign} label="Expenses" />
            <NavItem to="/insights" icon={ChartPie} label="Insights" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </div>
          
          <div className="mt-auto p-3 border-t">
            <div className="flex items-center gap-3 mb-3">
              {!isCollapsed && user && (
                <div className="flex items-center gap-2 py-1">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="text-xs bg-base-blue text-white">
                      {user.displayName?.slice(0, 2).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                    </span>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={handleDisconnect}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? "→" : "←"}
            </Button>
          </div>
        </aside>
      )}
      <main
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out",
          isAuthenticated ? (isCollapsed ? "ml-[60px]" : "ml-[240px]") : "ml-0"
        )}
      >
        {!isAuthenticated && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <BadgeDollarSign className="h-6 w-6 text-base-blue" />
              <span className="text-base-blue">SplitBase</span>
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <ConnectWallet />
              <ThemeToggle />
            </div>
          </header>
        )}
        {isAuthenticated && (
          <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-6">
            <div className="ml-auto flex items-center gap-4">
              <ThemeToggle />
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}
