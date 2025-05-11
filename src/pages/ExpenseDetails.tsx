import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserTransactions, getUserProfile, recordSettlement, getGroup, updateTransactionStatus } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, ExternalLink, AlertCircle } from "lucide-react";
import { formatCurrency, convertCurrency, CURRENCY_RATES, dateFormatter } from "@/lib/utils";
import type { Group, Transaction, Settlement } from "@/types";
import { AllowedCurrency } from "@/types";

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshTransactions, handlePaymentComplete, handleUsdcPayment: makeUsdcPayment } = useApp();
  const [expense, setExpense] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, loading, success, error
  const [txHash, setTxHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"eth" | "usdc">("eth");

  useEffect(() => {
    if (!user || !id) {
      navigate("/expenses");
      return;
    }

    const fetchExpenseDetails = async () => {
      try {
        setIsLoading(true);
        const transactions = await getUserTransactions(user.id);
        const foundExpense = transactions.find(tx => tx.id === id);
        if (!foundExpense) {
          navigate("/expenses");
          return;
        }

        // Check if the expense is already settled for this user
        if (foundExpense.settlements && Array.isArray(foundExpense.settlements)) {
          const userSettlement = foundExpense.settlements.find(s => s.payerId === user.id);
          if (userSettlement && userSettlement.status === "completed") {
            setIsPaid(true);
            setTxHash(userSettlement.transactionHash || "");
            setPaymentStatus("success");
          }
        }
    
        // If the transaction has a groupId, fetch the group to get the category
        if (foundExpense.groupId) {
          const groupData = await getGroup(foundExpense.groupId) as Group;
          console.log("Group data:", groupData);
          
          if (groupData?.expenses && Array.isArray(groupData.expenses)) {
            // First try to find by expense ID
            let matchedExpense = groupData.expenses.find(e => e.id === id);
            
            // If not found by ID, try to find by expenseId (which might be different from id)
            if (!matchedExpense && foundExpense.expenseId) {
              matchedExpense = groupData.expenses.find(e => e.id === foundExpense.expenseId);
            }
            
            // If still not found, try to match by description and amount
            if (!matchedExpense) {
              matchedExpense = groupData.expenses.find(e => 
                e.description === foundExpense.description && 
                e.amount === foundExpense.amount
              );
            }
            
            if (matchedExpense) {
              console.log("Matched expense in group:", matchedExpense);
              // Copy the category from the group expense to our foundExpense
              foundExpense.category = matchedExpense.category || "Food & Drinks";
            } else {
              console.log("Could not find matching expense in group data");
              // Set a default category if we can't find the expense in the group
              foundExpense.category = "Food & Drinks";
            }
          }
        }
    
        console.log("Final expense with category:", foundExpense);
        setExpense(foundExpense);
      } catch (error) {
        console.error("Error fetching expense details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenseDetails();
  }, [id, user, navigate]);

  // Calculate if current user owes money and to whom
  const calculateUserDebt = () => {
    if (!expense || !user) return { owes: false, amount: 0, to: null };

    // If user paid for the expense, they don't owe money
    if (expense.paidBy === user.id) return { owes: false, amount: 0, to: null };

    // If expense is already paid by this user, they don't owe money
    if (isPaid) return { owes: false, amount: 0, to: null };

    // Find if user is in splitBetween
    const userSplit = expense.splitBetween?.find(split => split.userId === user.id);
    if (!userSplit) return { owes: false, amount: 0, to: null };

    // Find the payer's name from memberDetails or use paidByName if available
    const payerName = expense.paidByName || 
      (expense.memberDetails && expense.paidBy && 
       expense.memberDetails[expense.paidBy]?.name) || 
      "Unknown";

    return {
      owes: true,
      amount: userSplit.amount,
      to: { id: expense.paidBy, name: payerName }
    };
  };

  const userDebt = expense ? calculateUserDebt() : { owes: false, amount: 0, to: null };

  // Convert currency to ETH
  const convertToETH = (amount: number, currency: string) => {
    // Make sure we're using one of the allowed currency types
    const validCurrency = (currency === "USD" || currency === "INR" || currency === "GBP" || 
                          currency === "EUR" || currency === "ETH") ? currency : "USD";
    return convertCurrency(amount, validCurrency, "ETH");
  };

  // Convert currency to USDC (1:1 with USD)
  const convertToUSDC = (amount: number, currency: string) => {
    // Make sure we're using one of the allowed currency types
    const validCurrency = (currency === "USD" || currency === "INR" || currency === "GBP" || 
                          currency === "EUR" || currency === "ETH") ? currency : "USD";
    // Convert to USD first (USDC is pegged to USD)
    return convertCurrency(amount, validCurrency, "USD");
  };

  // Helper function to get payer name
  const getPayerName = () => {
    if (!expense) return "Unknown";
    
    // First try to use paidByName directly if available
    if (expense.paidByName) return expense.paidByName;
    
    // Try to find the name in memberDetails using paidBy
    if (expense.memberDetails && expense.paidBy && expense.memberDetails[expense.paidBy]) {
      return expense.memberDetails[expense.paidBy].name;
    }
    
    // Look for the user with matching userId in splitBetween
    const payerInSplit = expense.splitBetween?.find(split => split.userId === expense.paidBy);
    if (payerInSplit && payerInSplit.userName) {
      return payerInSplit.userName;
    }
    
    return "Unknown";
  };

  // Helper function to get category using the same logic from GroupDetail component
  const getCategory = () => {
    return expense?.category || "Food & Drinks";
  };

  const handleEthPayment = async () => {
    if (!window.ethereum) {
      setErrorMessage("MetaMask is not installed. Please install MetaMask to make payments.");
      setPaymentStatus("error");
      return;
    }

    try {
      setPaymentStatus("loading");
      setErrorMessage("");

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Get recipient wallet address
      const recipientProfile = await getUserProfile(userDebt.to.id);
      
      // If we couldn't find a profile or it doesn't have a wallet address,
      // check if the ID itself is a wallet address (starts with 0x)
      let recipientWalletAddress;
      if (recipientProfile && recipientProfile.walletAddress) {
        recipientWalletAddress = recipientProfile.walletAddress;
      } else if (userDebt.to.id.startsWith("0x")) {
        recipientWalletAddress = userDebt.to.id;
      } else {
        throw new Error("Recipient wallet address not found");
      }

      // Convert amount to ETH
      const currency = expense.currency || "USD";
      const validCurrency = (currency === "USD" || currency === "INR" || currency === "GBP" || 
                            currency === "EUR" || currency === "ETH") ? currency : "USD";
      
      const ethAmount = convertToETH(userDebt.amount, validCurrency);
      const ethAmountInWei = ethers.utils.parseEther(ethAmount.toFixed(18));

      // Create transaction
      const tx = await signer.sendTransaction({
        to: recipientWalletAddress,
        value: ethAmountInWei
      });

      setTxHash(tx.hash);
      setPaymentStatus("success");
      setIsPaid(true);

      // Create settlement data with properly typed status
      const settlementData: Settlement = {
        payerId: user.id,
        receiverId: userDebt.to.id,
        amount: userDebt.amount,
        currency: validCurrency,
        expenseId: expense.id,
        transactionHash: tx.hash,
        status: "completed",
        paymentMethod: "eth"
      };

      // Use the handlePaymentComplete function from context instead of direct Firebase calls
      await handlePaymentComplete(expense.id, settlementData);
      
      // Update local state to reflect the payment
      setExpense(prev => {
        if (!prev) return null;
        const settlements = prev.settlements ? [...prev.settlements] : [];
        settlements.push(settlementData);
        return {
          ...prev,
          settlements
        };
      });

    } catch (error) {
      console.error("Payment error:", error);
      setErrorMessage(error.message || "Payment failed. Please try again.");
      setPaymentStatus("error");
    }
  };

  const processUsdcPayment = async () => {
    if (!window.ethereum) {
      setErrorMessage("MetaMask is not installed. Please install MetaMask to make payments.");
      setPaymentStatus("error");
      return;
    }

    try {
      setPaymentStatus("loading");
      setErrorMessage("");

      // Get recipient wallet address
      const recipientProfile = await getUserProfile(userDebt.to.id);
      
      let recipientWalletAddress;
      if (recipientProfile && recipientProfile.walletAddress) {
        recipientWalletAddress = recipientProfile.walletAddress;
      } else if (userDebt.to.id.startsWith("0x")) {
        recipientWalletAddress = userDebt.to.id;
      } else {
        throw new Error("Recipient wallet address not found");
      }

      // Convert amount to USDC
      const currency = expense.currency || "USD";
      const validCurrency = (currency === "USD" || currency === "INR" || currency === "GBP" || 
                            currency === "EUR" || currency === "ETH") ? currency : "USD";
      
      const usdcAmount = convertToUSDC(userDebt.amount, validCurrency);
      
      // Use the makeUsdcPayment function from context
      const txHash = await makeUsdcPayment(recipientWalletAddress, usdcAmount.toFixed(6));
      
      setTxHash(txHash);
      setPaymentStatus("success");
      setIsPaid(true);

      // Create settlement data
      const settlementData: Settlement = {
        payerId: user.id,
        receiverId: userDebt.to.id,
        amount: userDebt.amount,
        currency: validCurrency,
        expenseId: expense.id,
        transactionHash: txHash,
        status: "completed",
        paymentMethod: "usdc"
      };

      // Use the handlePaymentComplete function from context
      await handlePaymentComplete(expense.id, settlementData);
      
      // Update local state to reflect the payment
      setExpense(prev => {
        if (!prev) return null;
        const settlements = prev.settlements ? [...prev.settlements] : [];
        settlements.push(settlementData);
        return {
          ...prev,
          settlements
        };
      });

    } catch (error) {
      console.error("USDC Payment error:", error);
      setErrorMessage(error.message || "USDC payment failed. Please try again.");
      setPaymentStatus("error");
    }
  };

  const handlePayment = () => {
    if (paymentMethod === "eth") {
      handleEthPayment();
    } else {
      processUsdcPayment();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <Button variant="outline" onClick={() => navigate("/expenses")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
        </Button>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (!expense) {
    return (
      <Layout>
        <Button variant="outline" onClick={() => navigate("/expenses")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Expense not found.</AlertDescription>
        </Alert>
      </Layout>
    );
  }

  // Get correct payer name and category using our helper functions
  const payerName = getPayerName();
  const category = getCategory();

  return (
    <Layout>
      <Button variant="outline" onClick={() => navigate("/expenses")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Expenses
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{expense.description}</CardTitle>
          <CardDescription>
            {(() => {
              const date = expense.date instanceof Date ? expense.date : new Date(expense.date);
              return isNaN(date.getTime()) ? "Invalid date" : dateFormatter.format(date);
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium">Amount</h3>
              <p>{formatCurrency(expense.amount, expense.currency || "USD")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Paid by</h3>
              <p>{payerName}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Category</h3>
              <Badge variant="outline">{category}</Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium">Status</h3>
              <Badge variant={isPaid ? "secondary" : "outline"}>
                {isPaid ? "Paid" : "Pending"}
              </Badge>
            </div>
          </div>

          {expense.splitBetween && expense.splitBetween.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Split between</h3>
              <div className="space-y-2">
                {expense.splitBetween.map((split, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{split.userName || "Unknown"}</span>
                    <span>{formatCurrency(split.amount, expense.currency || "USD")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userDebt.owes && !isPaid && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-medium mb-2">You owe</h3>
              <p className="text-2xl font-bold mb-1">{formatCurrency(userDebt.amount, expense.currency || "USD")}</p>
              
              <Tabs defaultValue="eth" onValueChange={(value) => setPaymentMethod(value as "eth" | "usdc")}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="eth" className="data-[state=active]:bg-primary data-[state=active]:text-white">Pay with ETH</TabsTrigger>
                  <TabsTrigger value="usdc" className="data-[state=active]:bg-primary data-[state=active]:text-white">Pay with USDC</TabsTrigger>
                </TabsList>
                <TabsContent value="eth">
                  <p className="text-sm text-muted-foreground mb-4">
                    Payment will be made in ETH ({convertToETH(userDebt.amount, expense.currency || "USD").toFixed(6)} ETH)
                  </p>
                </TabsContent>
                <TabsContent value="usdc">
                  <p className="text-sm text-muted-foreground mb-4">
                    Payment will be made in USDC ({convertToUSDC(userDebt.amount, expense.currency || "USD").toFixed(2)} USDC)
                  </p>
                </TabsContent>
              </Tabs>

              {paymentStatus === "success" ? (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Payment Successful</AlertTitle>
                  <AlertDescription>
                    Your payment has been processed successfully.
                    {txHash && (
                      <a 
                        href={`https://sepolia.basescan.org/tx/${txHash}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center mt-2 text-blue-600 hover:underline"
                      >
                        View transaction <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              ) : paymentStatus === "error" ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Payment Failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              {paymentStatus !== "success" && (
                <Button 
                  onClick={handlePayment} 
                  disabled={paymentStatus === "loading"}
                  className="w-full mt-2"
                >
                  {paymentStatus === "loading" ? "Processing..." : `Pay with ${paymentMethod.toUpperCase()}`}
                </Button>
              )}
            </div>
          )}

          {isPaid && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg">
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-800">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-600 dark:text-green-400">Payment Completed</AlertTitle>
                <AlertDescription>
                  You've already paid this expense.
                  {txHash && (
                    <a 
                      href={`https://sepolia.basescan.org/tx/${txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center mt-2 text-blue-600 hover:underline"
                    >
                      View transaction <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
