import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserTransactions } from "@/components/UserTransactions";
import { ExpenseCard } from "@/components/ExpenseCard";
import { GroupCard } from "@/components/GroupCard";
import { ArrowRight, BadgeDollarSign, Plus, Users } from "lucide-react";
import { getUserGroups, getUserTransactions, getUserProfile, getGroup } from "@/lib/firebase";
import { getBudgetSuggestions } from "@/lib/ai";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import ConnectWallet from "@/components/ConnectWallet";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import type { Group } from "@/types";

const LandingPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-12">
      <div className="flex flex-col items-center space-y-4 text-center max-w-3xl">
        <div className="mb-4">
          <span className="inline-block p-3 rounded-full bg-base-gradient">
            <BadgeDollarSign size={40} className="text-white" />
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Split expenses with friends on the <span className="text-base-blue">Base Chain</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          The first web3-powered expense splitting app with built-in AI budgeting insights. 
          Track, split, and settle expenses with crypto on Base Sepolia Testnet.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <ConnectWallet />
          <Button variant="outline" onClick={() => window.open("https://base-sepolia.blockscout.com", "_blank")}>
            View Blockchain Explorer
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Easy Group Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Create groups for roommates, trips, or events. Add friends and track shared expenses seamlessly.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5" /> Multi-Currency Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Track expenses in USD, INR, GBP, EUR and settle debts using Base Sepolia ETH with automatic conversion.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="currentColor" />
              </svg> 
              AI-Powered Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Get personalized budget recommendations and expense analyses powered by Google's Gemini AI.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(true);
  
  // Data for the pie chart
  const [categoryData, setCategoryData] = useState([
    { name: 'Food & Drinks', value: 0 },
    { name: 'Transportation', value: 0 },
    { name: 'Shopping', value: 0 },
    { name: 'Entertainment', value: 0 },
    { name: 'Other', value: 0 },
  ]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Helper function to get expense category from group data
  const getExpenseCategory = async (expense) => {
    try {
      if (!expense) return "Other";
      
      // If the transaction already has a category, use it
      if (expense.category && expense.category !== "Other") {
        return expense.category;
      }
      
      // If the transaction has a groupId, fetch the group to get the category
      if (expense.groupId) {
        const groupData = await getGroup(expense.groupId) as Group;
        
        if (groupData?.expenses && Array.isArray(groupData.expenses)) {
          // First try to find by expense ID
          let matchedExpense = groupData.expenses.find(e => e.id === expense.id);
          
          // If not found by ID, try to find by expenseId (which might be different from id)
          if (!matchedExpense && expense.expenseId) {
            matchedExpense = groupData.expenses.find(e => e.id === expense.expenseId);
          }
          
          // If still not found, try to match by description and amount
          if (!matchedExpense) {
            matchedExpense = groupData.expenses.find(e => 
              e.description === expense.description && 
              e.amount === expense.amount
            );
          }
          
          if (matchedExpense) {
            return matchedExpense.category || "Food & Drinks";
          }
        }
      }
      
      // Default category if we couldn't determine it
      return expense.category || "Food & Drinks";
    } catch (error) {
      console.error("Error fetching expense category:", error);
      return expense.category || "Food & Drinks";
    }
  };

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          // Fetch groups
          const userGroups = await getUserGroups(user.id);
          setGroups(userGroups);
          
          // Fetch transactions
          const userTransactions = await getUserTransactions(user.id);
          
          // Update transactions with proper categories
          const enhancedTransactions = await Promise.all(
            userTransactions.map(async (transaction) => {
              const category = await getExpenseCategory(transaction);
              return { ...transaction, category };
            })
          );
          
          setTransactions(enhancedTransactions);

          // Process transaction data for AI analysis and chart
          if (enhancedTransactions.length > 0) {
            // Prepare data for AI analysis
            const currentMonthSpent: Record<string, number> = {};
            const previousMonthSpent: Record<string, number> = {};
            
            const now = new Date();
            const currentMonth = now.getMonth();
            const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const currentYear = now.getFullYear();
            const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            
            let currentMonthTotal = 0;
            let previousMonthTotal = 0;
            
            // Process transactions for AI and charts
            enhancedTransactions.forEach((transaction: any) => {
              const transactionDate = transaction.date?.toDate() || new Date();
              const transactionMonth = transactionDate.getMonth();
              const transactionYear = transactionDate.getFullYear();
              const category = transaction.category || 'Other';
              
              if (transactionMonth === currentMonth && transactionYear === currentYear) {
                currentMonthSpent[category] = (currentMonthSpent[category] || 0) + transaction.amount;
                currentMonthTotal += transaction.amount;
              } else if (transactionMonth === previousMonth && transactionYear === previousYear) {
                previousMonthSpent[category] = (previousMonthSpent[category] || 0) + transaction.amount;
                previousMonthTotal += transaction.amount;
              }
            });
            
            // Update chart data
            const newCategoryData = [
              { name: 'Food & Drinks', value: currentMonthSpent['Food & Drinks'] || 0 },
              { name: 'Transportation', value: currentMonthSpent['Transportation'] || 0 },
              { name: 'Shopping', value: currentMonthSpent['Shopping'] || 0 },
              { name: 'Entertainment', value: currentMonthSpent['Entertainment'] || 0 },
              { name: 'Other', value: currentMonthSpent['Other'] || 0 },
            ].filter(item => item.value > 0);
            
            if (newCategoryData.length > 0) {
              setCategoryData(newCategoryData);
            }
            
            // Get AI suggestions
            setAiLoading(true);
            const suggestions = await getBudgetSuggestions({
              transactions: enhancedTransactions.map((t: any) => ({
                description: t.description,
                amount: t.amount,
                date: t.date?.toDate() || new Date(),
                category: t.category,
              })),
              currentMonth: {
                spent: currentMonthSpent,
                total: currentMonthTotal,
              },
              previousMonth: {
                spent: previousMonthSpent,
                total: previousMonthTotal,
              },
            });
            setAiSuggestions(suggestions);
            setAiLoading(false);
          } else {
            setAiLoading(false);
            setAiSuggestions("Add your first expense to get personalized budget insights!");
          }
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }
  }, [user]);

  if (!user) {
    return <LandingPage />;
  }

  // Function to render AI insights in a more structured way
  const renderAIInsights = () => {
    if (!aiSuggestions) return null;
    
    // Split the content by paragraphs for better formatting
    const paragraphs = aiSuggestions.split('\n\n');
    
    return (
      <div className="prose prose-sm max-w-none">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mb-3 last:mb-0">{paragraph}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.displayName}
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => navigate("/expenses/add")}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
          <Button onClick={() => navigate("/groups/create")}>
            <Plus className="mr-2 h-4 w-4" /> Create Group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* AI Budget Insights */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>AI Budget Insights</CardTitle>
            <CardDescription>
              Personalized recommendations from Gemini AI
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] overflow-auto">
            {aiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[90%]" />
              </div>
            ) : (
              <div className="text-sm space-y-4">
                <Alert variant="default" className="bg-base-blue/5 border-base-blue/20">
                  <AlertTitle className="text-base font-medium text-base-blue mb-2">Budget Analysis</AlertTitle>
                  <AlertDescription>
                    {renderAIInsights()}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-md" />
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip formatter={(value) => [`${value}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground">
                No expense data to display
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Groups */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Groups</h2>
          <Button variant="link" onClick={() => navigate("/groups")}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.slice(0, 3).map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => navigate(`/groups/${group.id}`)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No Groups Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a group to start tracking shared expenses with friends
              </p>
              <Button onClick={() => navigate("/groups/create")}>
                <Plus className="mr-2 h-4 w-4" /> Create Group
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Button variant="link" onClick={() => navigate("/expenses")}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {transactions
              .sort((a, b) => b.date?.toDate() - a.date?.toDate())
              .slice(0, 3)
              .map((transaction) => (
                <ExpenseCard
                  key={transaction.id}
                  expense={{
                    id: transaction.id,
                    description: transaction.description,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    date: transaction.date?.toDate() || new Date(),
                    paidBy: transaction.paidBy,
                    paidByName: transaction.paidByName || "Unknown",
                    category: transaction.category || "Other",
                    splitBetween: transaction.splitBetween || [],
                  }}
                  currentUserId={user.id}
                  onClick={() => navigate(`/expenses/${transaction.id}`)}
                />
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <BadgeDollarSign className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No Expenses Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first expense to start tracking
              </p>
              <Button onClick={() => navigate("/expenses/add")}>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default function Index() {
  const { isAuthenticated, hasCheckedAuth } = useApp();

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}
