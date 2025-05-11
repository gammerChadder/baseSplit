// src/contexts/AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { createUserProfile, getUserProfile, updateUserProfile, ensureAuthenticated, getUserTransactions, updateTransactionStatus } from "@/lib/firebase";
import { sendUsdcTransaction } from "@/lib/web3";
import { displayToast } from "@/lib/utils";
import { User, Transaction, Settlement } from "@/types";
import { useAccount, useBalance } from "wagmi";

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCheckedAuth: boolean;
  transactions: Transaction[];
  connectUser: () => Promise<void>;
  disconnectUser: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshTransactions: () => Promise<void>;
  handlePaymentComplete: (transactionId: string, settlementData: Settlement) => Promise<void>;
  handleUsdcPayment: (to: string, amount: string) => Promise<string>;
  setUser: (user: User) => void;
}

const AppContext = createContext<AppContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasCheckedAuth: false,
  transactions: [],
  connectUser: async () => {},
  disconnectUser: () => {},
  updateUser: async () => {},
  refreshTransactions: async () => {},
  handlePaymentComplete: async () => {},
  handleUsdcPayment: async () => "",
  setUser: () => {},
});

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({
    address: address,
  });

  const refreshTransactions = async () => {
    if (!user) return;
    
    try {
      const userTransactions = await getUserTransactions(user.id);
      setTransactions(userTransactions);
    } catch (error) {
      console.error("Error refreshing transactions:", error);
    }
  };

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const savedAddress = localStorage.getItem("walletAddress");
        if (savedAddress) {
          try {
            // Ensure authentication with the wallet address
            await ensureAuthenticated(savedAddress);
            
            const userProfile = await getUserProfile(savedAddress);
            if (userProfile) {
              setUser({
                ...userProfile as User,
                balance: balanceData?.formatted || "0",
                usdcBalance: "0", // We'll update this later if needed
              });
            } else {
              // Clear saved address if no matching profile
              localStorage.removeItem("walletAddress");
              console.log("No user profile found for saved address");
            }
          } catch (error) {
            // Couldn't connect to wallet or get user profile, clear saved address
            console.error("Error during authentication check:", error);
            localStorage.removeItem("walletAddress");
          }
        }
      } catch (error) {
        console.error("Authentication check error:", error);
      } finally {
        setIsLoading(false);
        setHasCheckedAuth(true);
      }
    };

    checkAuthentication();
  }, [balanceData]);

  // Load transactions when user changes
  useEffect(() => {
    if (user) {
      refreshTransactions();
    }
  }, [user]);

  // Update user when wallet connection changes
  useEffect(() => {
    if (isConnected && address && balanceData) {
      // Update user with latest balance
      if (user && user.walletAddress === address) {
        setUser({
          ...user,
          balance: balanceData.formatted,
        });
      }
    }
  }, [isConnected, address, balanceData]);

  const handlePaymentComplete = async (transactionId: string, settlementData: Settlement) => {
    try {
      setIsLoading(true);
      
      // Update transaction status
      await updateTransactionStatus(transactionId, user.id, settlementData);
      
      // Refresh transactions to get the updated data
      await refreshTransactions();
      
      displayToast("Payment Complete", "Your payment has been recorded successfully!", "success");
    } catch (error) {
      console.error("Error completing payment:", error);
      displayToast("Payment Error", "Failed to record your payment", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsdcPayment = async (to: string, amount: string) => {
    try {
      setIsLoading(true);
      const txHash = await sendUsdcTransaction(to, amount);
      displayToast("USDC Payment Sent", "Your USDC payment has been processed!", "success");
      return txHash;
    } catch (error) {
      console.error("USDC payment error:", error);
      displayToast("USDC Payment Failed", "Could not process USDC payment", "error");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const connectUser = async () => {
  try {
    setIsLoading(true);
    
    if (isConnected && address) {
      // We're already connected via OnchainKit
      try {
        await ensureAuthenticated(address);
        
        let userProfile;
        try {
          userProfile = await getUserProfile(address);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
        
        if (!userProfile) {
          try {
            userProfile = await createUserProfile(address);
          } catch (error) {
            console.error("Error creating user profile:", error);
            userProfile = {
              id: address,
              walletAddress: address,
              displayName: `User_${address.slice(0, 6)}`,
              defaultCurrency: "USD"
            };
          }
        }
        
        setUser({
          ...userProfile as User,
          balance: balanceData?.formatted || "0",
          usdcBalance: "0",
        });
        
        localStorage.setItem("walletAddress", address);
        displayToast("Connected", "Wallet connected successfully!", "success");
        
        // Return the user for potential chaining
        return userProfile;
      } catch (error) {
        displayToast("Authentication Failed", "Could not authenticate with wallet", "error");
        throw error;
      }
    } else {
      throw new Error("Wallet not connected");
    }
  } catch (error: any) {
    displayToast("Connection Failed", error.message || "Could not connect wallet", "error");
    throw error;
  } finally {
    setIsLoading(false);
  }
};

  const disconnectUser = () => {
  // Clear user state
  setUser(null);
  
  // Remove from localStorage
  localStorage.removeItem("walletAddress");
  
  // Show success message
  displayToast("Disconnected", "Wallet disconnected successfully!", "info");
  
  // You can add any additional cleanup here
  setTransactions([]);
};

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Ensure authentication
      await ensureAuthenticated(user.walletAddress);
      
      try {
        await updateUserProfile(user.id, data);
      } catch (error) {
        console.error("Error updating user profile in database:", error);
      }
      
      setUser({ ...user, ...data });
      displayToast("Updated", "Profile updated successfully!", "success");
    } catch (error) {
      displayToast("Update Failed", "Could not update profile", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasCheckedAuth,
        transactions,
        connectUser,
        disconnectUser,
        updateUser,
        handlePaymentComplete,
        refreshTransactions,
        handleUsdcPayment,
        setUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
