import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserTransactions, ensureAuthenticated, getGroup } from "@/lib/firebase";
import { getBudgetSuggestions } from "@/lib/ai";
import { CURRENCY_SYMBOLS, formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Group } from "@/types";

export default function Insights() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"month" | "year">("month");
  
  // Chart data states
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];
  
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
  
  // Function to render AI insights in a more structured way
  const renderAIInsights = () => {
    if (!aiSuggestions) return null;
    
    // Split the content by paragraphs for better formatting
    const paragraphs = aiSuggestions.split('\n\n');
    
    return (
      <div className="prose prose-sm max-w-none">
        {paragraphs.map((paragraph, index) => {
          // Check if paragraph appears to be a section header
          if (paragraph.endsWith(':') && paragraph.length < 50) {
            return <h3 key={index} className="text-base-blue font-medium mt-3 mb-2">{paragraph}</h3>;
          }
          return <p key={index} className="mb-3 last:mb-0">{paragraph}</p>;
        })}
      </div>
    );
  };
  
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          // Ensure authentication before fetching data
          await ensureAuthenticated(user.walletAddress);
          
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
          
          // Process transaction data for charts
          if (enhancedTransactions.length > 0) {
            processTransactionData(enhancedTransactions);
            
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
          console.error("Error fetching insights data:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      let currentMonthSpent: Record<string, number> = {};
      let previousMonthSpent: Record<string, number> = {};
      let currentMonthTotal = 0;
      let previousMonthTotal = 0;
      
      const processTransactionData = (userTransactions: any[]) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const currentYear = now.getFullYear();
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        // Reset variables
        currentMonthSpent = {};
        previousMonthSpent = {};
        currentMonthTotal = 0;
        previousMonthTotal = 0;
        
        // Process for category chart
        const categoryAmounts: Record<string, number> = {};
        
        // Process for timeline chart
        const timelineAmounts: Record<string, number> = {};
        const timelineCountsByDay: Record<string, number> = {};
        
        // Process transactions for charts
        userTransactions.forEach((transaction: any) => {
          const transactionDate = transaction.date?.toDate() || new Date();
          const category = transaction.category || 'Other';
          
          // Format date for timeline
          let timeKey;
          if (timeRange === "month") {
            // For month view, group by day of month
            timeKey = transactionDate.toISOString().slice(0, 10); // YYYY-MM-DD
          } else {
            // For year view, group by month
            timeKey = transactionDate.toISOString().slice(0, 7); // YYYY-MM
          }
          
          // Category data
          categoryAmounts[category] = (categoryAmounts[category] || 0) + transaction.amount;
          
          // Timeline data
          timelineAmounts[timeKey] = (timelineAmounts[timeKey] || 0) + transaction.amount;
          timelineCountsByDay[timeKey] = (timelineCountsByDay[timeKey] || 0) + 1;
          
          // Month comparison data
          const transactionMonth = transactionDate.getMonth();
          const transactionYear = transactionDate.getFullYear();
          
          if (transactionMonth === currentMonth && transactionYear === currentYear) {
            currentMonthSpent[category] = (currentMonthSpent[category] || 0) + transaction.amount;
            currentMonthTotal += transaction.amount;
          } else if (transactionMonth === previousMonth && transactionYear === previousYear) {
            previousMonthSpent[category] = (previousMonthSpent[category] || 0) + transaction.amount;
            previousMonthTotal += transaction.amount;
          }
        });
        
        // Transform category data for pie chart
        const categoryChartData = Object.entries(categoryAmounts).map(([name, value]) => ({
          name,
          value,
        }));
        setCategoryData(categoryChartData);
        
        // Transform timeline data for line chart
        let timelineDates: string[];
        if (timeRange === "month") {
          // For month view, get all days in current month
          const year = now.getFullYear();
          const month = now.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          timelineDates = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          });
        } else {
          // For year view, get all months in current year
          const year = now.getFullYear();
          timelineDates = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            return `${year}-${String(month).padStart(2, '0')}`;
          });
        }
        
        const timelineChartData = timelineDates.map(date => {
          const displayDate = timeRange === "month" ? date.slice(8, 10) : date.slice(5, 7);
          return {
            date: displayDate,
            amount: timelineAmounts[date] || 0,
            count: timelineCountsByDay[date] || 0,
          };
        });
        setTimelineData(timelineChartData);
        
        // Transform month comparison data for bar chart
        const categories = Array.from(new Set([
          ...Object.keys(currentMonthSpent),
          ...Object.keys(previousMonthSpent),
        ]));
        
        const comparisonChartData = categories.map(category => ({
          name: category,
          current: currentMonthSpent[category] || 0,
          previous: previousMonthSpent[category] || 0,
        }));
        setComparisonData(comparisonChartData);
      };

      fetchData();
    }
  }, [user, timeRange]);

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Insights</h1>
          <p className="text-muted-foreground">
            Analyze your spending patterns and get AI-powered recommendations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </>
          ) : (
            <>
              <Card className="transition-all hover:shadow-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {formatCurrency(transactions.reduce((sum, t) => sum + t.amount, 0), user.defaultCurrency as any)}
                  </div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              
              <Card className="transition-all hover:shadow-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      transactions
                        .filter(t => {
                          const date = t.date?.toDate() || new Date();
                          const now = new Date();
                          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                        })
                        .reduce((sum, t) => sum + t.amount, 0),
                      user.defaultCurrency as any
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Current month</p>
                </CardContent>
              </Card>
              
              <Card className="transition-all hover:shadow-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {transactions.length > 0
                      ? formatCurrency(
                          transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length,
                          user.defaultCurrency as any
                        )
                      : formatCurrency(0, user.defaultCurrency as any)}
                  </div>
                  <p className="text-xs text-muted-foreground">Per transaction</p>
                </CardContent>
              </Card>
              
              <Card className="transition-all hover:shadow-md">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium">Transaction Count</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">{transactions.length}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* AI Budget Insights */}
        <Card className="transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle>AI Budget Insights</CardTitle>
            <CardDescription>
              Personalized recommendations from Gemini AI
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-auto">
            {aiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            ) : (
              <div className="text-sm space-y-4">
                {transactions.length > 0 ? (
                  <Alert variant="default" className="bg-base-blue/5 border-base-blue/20">
                    <AlertTitle className="text-base font-medium text-base-blue mb-2">Budget Analysis</AlertTitle>
                    <AlertDescription className="mt-1">
                      {renderAIInsights()}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertTitle>No Data Available</AlertTitle>
                    <AlertDescription>
                      Add your first expense to get personalized budget insights!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <Tabs defaultValue="category" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="category">Category Breakdown</TabsTrigger>
              <TabsTrigger value="timeline">Spending Timeline</TabsTrigger>
              <TabsTrigger value="comparison">Month Comparison</TabsTrigger>
            </TabsList>
            
            {/* Time range selector for timeline */}
            <div className="flex items-center">
              <TabsList className="ml-2">
                <TabsTrigger
                  value="month"
                  className={timeRange === "month" ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => setTimeRange("month")}
                >
                  Month
                </TabsTrigger>
                <TabsTrigger
                  value="year"
                  className={timeRange === "year" ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => setTimeRange("year")}
                >
                  Year
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          
          <TabsContent value="category" className="pt-4">
            <Card className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>
                  Breakdown of your expenses by category
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [
                          `${CURRENCY_SYMBOLS[user.defaultCurrency] || "$"}${value.toFixed(2)}`,
                          "Amount"
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="timeline" className="pt-4">
            <Card className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle>Spending Timeline</CardTitle>
                <CardDescription>
                  {timeRange === "month" ? "Your daily expenses for the current month" : "Your monthly expenses for the current year"}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={timelineData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        label={{ 
                          value: timeRange === "month" ? "Day" : "Month", 
                          position: "insideBottomRight", 
                          offset: -10 
                        }} 
                      />
                      <YAxis 
                        label={{ 
                          value: "Amount", 
                          angle: -90, 
                          position: "insideLeft" 
                        }} 
                      />
                      <Tooltip 
                        formatter={(value: any) => [
                          `${CURRENCY_SYMBOLS[user.defaultCurrency] || "$"}${value.toFixed(2)}`,
                          "Amount"
                        ]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="#0052FF" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="comparison" className="pt-4">
            <Card className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle>Month Comparison</CardTitle>
                <CardDescription>
                  Compare current month with previous month by category
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : comparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparisonData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any) => [
                          `${CURRENCY_SYMBOLS[user.defaultCurrency] || "$"}${value.toFixed(2)}`,
                          "Amount"
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="current" name="Current Month" fill="#0052FF" />
                      <Bar dataKey="previous" name="Previous Month" fill="#8E78FF" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No comparison data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
