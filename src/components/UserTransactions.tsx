
import React, { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, convertCurrency } from "@/lib/utils";
import { sendTransaction } from "@/lib/web3";
import { recordSettlement, updateSettlementStatus } from "@/lib/firebase";
import { displayToast } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface UserTransactionsProps {
  userId: string;
  userName: string;
  transactions: any[];
  onRefresh?: () => void;
}

export function UserTransactions({ userId, userName, transactions, onRefresh }: UserTransactionsProps) {
  const { user } = useApp();
  const [isSending, setIsSending] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [ethAmount, setEthAmount] = useState<string>("");
  
  // Calculate total balance
  const [balances, setBalances] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const calculateBalances = () => {
      const newBalances: Record<string, number> = {};
      
      transactions.forEach(transaction => {
        const currency = transaction.currency || "USD";
        
        if (transaction.paidBy === user?.id) {
          // Current user paid for the expense
          const userSplit = transaction.splitBetween.find((split: any) => split.userId === userId);
          if (userSplit) {
            newBalances[currency] = (newBalances[currency] || 0) + userSplit.amount;
          }
        } else if (transaction.paidBy === userId) {
          // The other user paid for the expense
          const currentUserSplit = transaction.splitBetween.find((split: any) => split.userId === user?.id);
          if (currentUserSplit) {
            newBalances[currency] = (newBalances[currency] || 0) - currentUserSplit.amount;
          }
        }
      });
      
      setBalances(newBalances);
      
      // Calculate total amount in the default currency
      const totalAmount = Object.entries(newBalances).reduce((total, [currency, amount]) => {
        return total + convertCurrency(amount, currency as any, (user?.defaultCurrency || "USD") as any);
      }, 0);
      
      setAmount(totalAmount);
      
      // Calculate equivalent ETH amount
      const ethEquivalent = convertCurrency(
        totalAmount, 
        (user?.defaultCurrency || "USD") as any, 
        "ETH"
      );
      setEthAmount(ethEquivalent.toFixed(6));
    };
    
    if (user && transactions.length > 0) {
      calculateBalances();
    }
  }, [transactions, user, userId]);
  
  const handleSettleUp = async () => {
    if (!user || !userId || amount <= 0) return;
    
    try {
      setIsSending(true);
      
      // Get the receiving wallet address
      const receivingAddress = userId;
      
      // Send the transaction
      const txHash = await sendTransaction(
        receivingAddress,
        ethAmount
      );
      
      // Record the settlement
      await recordSettlement({
        groupId: "direct", // For direct settlements
        payerId: user.id,
        receiverId: userId,
        amount,
        currency: user.defaultCurrency,
        transactionHash: txHash,
      });
      
      displayToast("Payment Successful", `You've successfully paid ${userName}`, "success");
      
      // Refresh the transactions list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error("Error settling up:", error);
      displayToast("Payment Failed", error.message, "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance with {userName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(balances).length > 0 ? (
          <>
            {Object.entries(balances).map(([currency, balance]) => (
              <div key={currency} className="flex justify-between items-center">
                <span>{currency}:</span>
                <span className={balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : ""}>
                  {formatCurrency(Math.abs(balance), currency as any)}
                  {balance > 0 ? " (they owe you)" : balance < 0 ? " (you owe)" : ""}
                </span>
              </div>
            ))}
            
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex justify-between items-center font-medium">
                <span>Total ({user?.defaultCurrency}):</span>
                <span className={amount > 0 ? "text-green-600" : amount < 0 ? "text-red-600" : ""}>
                  {formatCurrency(Math.abs(amount), user?.defaultCurrency as any)}
                  {amount > 0 ? " (they owe you)" : amount < 0 ? " (you owe)" : ""}
                </span>
              </div>
              
              {amount !== 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  Equivalent to {ethAmount} ETH
                </div>
              )}
            </div>
            
            {amount < 0 && (
              <div className="pt-4">
                <Button 
                  className="w-full" 
                  onClick={handleSettleUp}
                  disabled={isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Payment...
                    </>
                  ) : (
                    `Settle Up (Pay ${ethAmount} ETH)`
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-muted-foreground">No transactions with this user</p>
        )}
      </CardContent>
    </Card>
  );
}
