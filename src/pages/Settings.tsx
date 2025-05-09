
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { displayToast, shortenAddress } from "@/lib/utils";
import { getBalance } from "@/lib/web3";

export default function Settings() {
  const { user, isLoading: isAppLoading, updateUser, disconnectUser } = useApp();
  const navigate = useNavigate();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    defaultCurrency: user?.defaultCurrency || "USD",
  });
  const [balance, setBalance] = useState<string | null>(user?.balance || null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
      setIsUpdating(true);
      
      if (!formData.displayName.trim()) {
        throw new Error("Display name is required");
      }
      
      // Update user profile
      await updateUser({
        displayName: formData.displayName,
        defaultCurrency: formData.defaultCurrency,
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      displayToast("Update Error", error.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleRefreshBalance = async () => {
    if (!user) return;
    
    try {
      setIsRefreshingBalance(true);
      const newBalance = await getBalance(user.walletAddress);
      setBalance(newBalance);
    } catch (error) {
      console.error("Error refreshing balance:", error);
      displayToast("Balance Error", "Could not refresh balance", "error");
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="walletAddress">Wallet Address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="walletAddress"
                  value={user.walletAddress}
                  disabled
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(user.walletAddress)}
                  className="whitespace-nowrap"
                >
                  Copy
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Select
                value={formData.defaultCurrency}
                onValueChange={(value) => setFormData({ ...formData, defaultCurrency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="INR">INR (₹)</SelectItem>
                  <SelectItem value="ETH">ETH (Ξ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/")}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet Balance</CardTitle>
            <CardDescription>
              Your current Base Sepolia testnet wallet balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Balance:</p>
                <p className="text-2xl font-bold">{balance} ETH</p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefreshBalance}
                disabled={isRefreshingBalance}
              >
                {isRefreshingBalance ? "Refreshing..." : "Refresh Balance"}
              </Button>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">
                To get testnet ETH, visit the Base Sepolia faucet
              </p>
              <a
                href="https://sepoliafaucet.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base-blue hover:underline inline-flex items-center gap-1 mt-1"
              >
                Base Sepolia Faucet
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Preferences</CardTitle>
            <CardDescription>
              Customize your application preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Network</p>
                <p className="text-sm text-muted-foreground">
                  Currently connected to testnet
                </p>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Base Sepolia
              </Badge>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">App Version</p>
                <p className="text-sm text-muted-foreground">
                  Current version of the application
                </p>
              </div>
              <span className="text-sm">1.0.0</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Disconnect Wallet</CardTitle>
            <CardDescription>
              Disconnect your wallet from this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This will log you out of the application. You can reconnect your wallet at any time.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="destructive" onClick={disconnectUser}>
              Disconnect Wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
