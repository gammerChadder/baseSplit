// groupDetail.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseCard } from "@/components/ExpenseCard";
import { 
  getGroup, 
  getUserProfile,
  createExpense,
} from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, ArrowLeft, BadgeDollarSign } from "lucide-react";
import { formatCurrency, convertCurrency, CURRENCY_SYMBOLS } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getExpenseCategorySuggestion, simplifyExpenseExplanation } from "@/lib/ai";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Group, User, Expense } from "@/types";


export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, transactions } = useApp();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [showExpenseDetailDialog, setShowExpenseDetailDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [expenseExplanation, setExpenseExplanation] = useState<string>("");
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  
  // New expense form state
  const [newExpenseForm, setNewExpenseForm] = useState({
    description: "",
    amount: "",
    currency: "USD",
    paidBy: "",
    category: "",
    splitType: "equal", // equal, percentage, or exact
    splitValues: {} as Record<string, string>, // userId: amount
  });
  const [isCreatingExpense, setIsCreatingExpense] = useState(false);
  
  useEffect(() => {
    if (user && id) {
      const fetchGroupDetails = async () => {
              try {
                const groupData = await getGroup(id) as Group | null;
                if (!groupData) {
                  navigate("/groups");
                  return;
                }
                setGroup(groupData);
                
                // Fetch member details
                const memberDetails = [];
                
                // Process all members from the members array
                for (const memberId of groupData.members) {
                  try {
                    // First check if memberDetails is available in group data
                    let memberProfile: User | null = null;
                    let memberName = "";
                    
                    if (groupData.memberDetails && groupData.memberDetails[memberId]) {
                      memberName = groupData.memberDetails[memberId].name || "";
                    }
                    
                    // Try to fetch the user profile
                    try {
                      memberProfile = await getUserProfile(memberId) as User | null;
                    } catch (err) {
                      console.warn(`Could not fetch profile for member ${memberId}:`, err);
                    }
                    
                    // If no profile was found, create one from the member details
                    if (!memberProfile) {
                      memberProfile = {
                        id: memberId,
                        walletAddress: memberId,
                        displayName: memberName || memberId.slice(0, 6) + "...",
                        defaultCurrency: groupData.defaultCurrency || "USD"
                      };
                    }
                    
                    // If memberProfile exists but no displayName, use the one from memberDetails
                    if (memberProfile && !memberProfile.displayName && memberName) {
                      memberProfile.displayName = memberName;
                    }
                    
                    // Ensure we have a valid display name
                    if (!memberProfile.displayName) {
                      memberProfile.displayName = memberId.slice(0, 6) + "...";
                    }
                    
                    memberDetails.push(memberProfile);
                  } catch (err) {
                    console.error(`Error processing member ${memberId}:`, err);
                    // Still add a basic profile to ensure the member is shown
                    memberDetails.push({
                      id: memberId,
                      walletAddress: memberId,
                      displayName: memberId.slice(0, 6) + "...",
                      defaultCurrency: groupData.defaultCurrency || "USD"
                    });
                  }
                  console.log("Processed member details:", memberDetails);
            setMembers(memberDetails);
                }
          
          // Setup expenses with full details
          const enhancedExpenses = (groupData.expenses || []).map((expense: any) => {
  const paidByUser = memberDetails.find((member) => member.id === expense.paidBy);
  
  // Find matching transaction to check settlement status
  const matchingTransaction = transactions.find(t => 
    t.expenseId === expense.id || 
    (t.description === expense.description && t.amount === expense.amount)
  );
  
  // Check if current user has paid this expense
  const isPaidByCurrentUser = matchingTransaction?.settlements?.some(
    settlement => settlement.payerId === user.id && settlement.status === "completed"
  ) || false;
  
  const splitBetween = expense.splitBetween.map((split: any) => {
    const splitUser = memberDetails.find((member) => member.id === split.userId);
    return {
      ...split,
      userName: splitUser?.displayName || "Unknown",
      isPaid: split.userId === user.id ? isPaidByCurrentUser : false
    };
  });
  
  return {
    ...expense,
    date: expense.date?.toDate() || new Date(),
    paidByName: paidByUser?.displayName || "Unknown",
    splitBetween,
    isPaidByCurrentUser
  };
});
          
          setExpenses(enhancedExpenses);
          
          // Initialize new expense form with current user as payer
          setNewExpenseForm(prev => ({
            ...prev,
            currency: groupData.defaultCurrency || "USD",
            paidBy: user.id,
          }));
        } catch (error) {
          console.error("Error fetching group details:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchGroupDetails();
    }
  }, [id, user, navigate]);
  
  const handleShowAddExpenseDialog = () => {
    setShowAddExpenseDialog(true);
  };
  
  const handleExpenseDescriptionChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const description = e.target.value;
    setNewExpenseForm(prev => ({ ...prev, description }));
    
    // If description is long enough, suggest a category
    if (description.length > 3) {
      try {
        const suggestedCategory = await getExpenseCategorySuggestion(description);
        setNewExpenseForm(prev => ({ ...prev, category: suggestedCategory }));
      } catch (error) {
        console.error("Error getting category suggestion:", error);
      }
    }
  };
  
  const handleSplitTypeChange = (value: string) => {
    setNewExpenseForm(prev => ({
      ...prev,
      splitType: value,
      splitValues: {},
    }));
    
    // If equal split, pre-calculate values
    if (value === "equal" && members.length > 0) {
      const amount = parseFloat(newExpenseForm.amount || "0");
      if (!isNaN(amount)) {
        const equalShare = amount / members.length;
        const newSplitValues = {} as Record<string, string>;
        
        // Calculate equal shares with proper rounding
        members.forEach((member, index) => {
          // For the last member, calculate to ensure sum equals total
          if (index === members.length - 1) {
            const sumSoFar = members.slice(0, index).reduce(
              (sum, m) => sum + parseFloat(newSplitValues[m.id] || "0"), 
              0
            );
            newSplitValues[member.id] = (amount - sumSoFar).toFixed(2);
          } else {
            newSplitValues[member.id] = equalShare.toFixed(2);
          }
        });
        
        setNewExpenseForm(prev => ({
          ...prev,
          splitValues: newSplitValues,
        }));
      }
    }
  };
  
  const handleSplitValueChange = (memberId: string, value: string) => {
    setNewExpenseForm(prev => ({
      ...prev,
      splitValues: {
        ...prev.splitValues,
        [memberId]: value
      }
    }));
  };
  
  const createNewExpense = async () => {
    if (!user || !group) return;
    
    try {
      setIsCreatingExpense(true);
      
      const amount = parseFloat(newExpenseForm.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }
      
      if (!newExpenseForm.description.trim()) {
        throw new Error("Please enter a description");
      }
      
      const splitBetween = [];
      
      for (const member of members) {
        const splitAmount = parseFloat(newExpenseForm.splitValues[member.id] || "0");
        
        if (isNaN(splitAmount)) {
          throw new Error("Invalid split amount for " + member.displayName);
        }
        
        splitBetween.push({
          userId: member.id,
          userName: member.displayName,
          amount: splitAmount,
        });
      }
      
      const totalSplit = splitBetween.reduce((sum, item) => sum + item.amount, 0);
      
      if (Math.abs(totalSplit - amount) > 0.01) {
        throw new Error("The sum of all splits should equal the total amount");
      }
      
      // Create the expense
      const newExpense = await createExpense(group.id, {
        description: newExpenseForm.description,
        amount,
        currency: newExpenseForm.currency,
        paidBy: newExpenseForm.paidBy,
        splitBetween,
        date: new Date(),
        category: newExpenseForm.category,
      });
      
      // Update local state
      if (newExpense) {
        const paidByUser = members.find((member) => member.id === newExpense.paidBy);
        
        const enhancedExpense = {
          ...newExpense,
          date: newExpense.date?.toDate() || new Date(),
          paidByName: paidByUser?.displayName || "Unknown",
        };
        
        setExpenses(prev => [...prev, enhancedExpense]);
        
        // Update group total
        setGroup(prev => ({
          ...prev,
          totalExpenses: prev.totalExpenses + amount,
        }));
        
        // Reset form and close dialog
        setNewExpenseForm({
          description: "",
          amount: "",
          currency: group.defaultCurrency || "USD",
          paidBy: user.id,
          category: "",
          splitType: "equal",
          splitValues: {},
        });
        
        setShowAddExpenseDialog(false);
      }
    } catch (error: any) {
      console.error("Error creating expense:", error);
      alert(error.message);
    } finally {
      setIsCreatingExpense(false);
    }
  };
  
  const handleShowExpenseDetails = async (expense: any) => {
    setSelectedExpense(expense);
    setShowExpenseDetailDialog(true);
    
    // Get AI explanation
    try {
      setIsLoadingExplanation(true);
      const explanation = await simplifyExpenseExplanation(expense);
      setExpenseExplanation(explanation);
    } catch (error) {
      console.error("Error getting expense explanation:", error);
      setExpenseExplanation("");
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex gap-4 items-center">
          <Button variant="outline" size="icon" onClick={() => navigate("/groups")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isLoading ? <Skeleton className="h-9 w-40" /> : group?.name}
            </h1>
            {!isLoading && group?.description && (
              <p className="text-muted-foreground">{group.description}</p>
            )}
          </div>
          <div className="ml-auto">
            <Button onClick={handleShowAddExpenseDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(group?.totalExpenses || 0, group?.defaultCurrency as any)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Default currency: {group?.defaultCurrency || "USD"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <Badge variant="outline" key={member.id} className="flex items-center gap-1.5 py-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.displayName}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expenses.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total expenses recorded
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="expenses">
          <TabsList>
            <TabsTrigger value="expenses">
              <BadgeDollarSign className="mr-2 h-4 w-4" /> Expenses
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" /> Members
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses" className="space-y-4 pt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : expenses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenses
                  .sort((a, b) => b.date - a.date)
                  .map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      expense={{
                      ...expense,
                      settlements: transactions.find(t => t.expenseId === expense.id)?.settlements
                    }}
                    currentUserId={user.id}
                    onClick={() => handleShowExpenseDetails(expense)}
                  />
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BadgeDollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No Expenses Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Add your first expense to start tracking
                </p>
                <Button onClick={handleShowAddExpenseDialog}>
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="members" className="space-y-4 pt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.id === group.creator ? "Admin" : "Member"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p>No members found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Add Expense Dialog */}
      <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense to split with the group
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Dinner at Restaurant"
                  value={newExpenseForm.description}
                  onChange={handleExpenseDescriptionChange}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={newExpenseForm.currency}
                    onValueChange={(value) => setNewExpenseForm(prev => ({ ...prev, currency: value }))}
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
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paid-by">Paid By</Label>
                  <Select
                    value={newExpenseForm.paidBy}
                    onValueChange={(value) => setNewExpenseForm(prev => ({ ...prev, paidBy: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newExpenseForm.category}
                    onValueChange={(value) => setNewExpenseForm(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Food & Drinks">Food & Drinks</SelectItem>
                      <SelectItem value="Transportation">Transportation</SelectItem>
                      <SelectItem value="Accommodation">Accommodation</SelectItem>
                      <SelectItem value="Shopping">Shopping</SelectItem>
                      <SelectItem value="Entertainment">Entertainment</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Medical">Medical</SelectItem>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="split-type">Split Type</Label>
                <Select
                  value={newExpenseForm.splitType}
                  onValueChange={handleSplitTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select split type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Split Equally</SelectItem>
                    <SelectItem value="exact">Split by Exact Amounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {newExpenseForm.splitType === "exact" && (
                <div className="space-y-2">
                  <Label>Split Amounts</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <span className="text-sm flex-shrink-0 w-24 truncate">
                          {member.displayName}:
                        </span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={newExpenseForm.splitValues[member.id] || ""}
                          onChange={(e) => handleSplitValueChange(member.id, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {newExpenseForm.splitType === "equal" && newExpenseForm.amount && (
                <div className="space-y-2">
                  <Label>Split Preview</Label>
                  <div className="text-sm text-muted-foreground">
                    Each person will pay {formatCurrency(
                      parseFloat(newExpenseForm.amount) / members.length,
                      newExpenseForm.currency as any
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewExpense} disabled={isCreatingExpense}>
              {isCreatingExpense ? "Creating..." : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Detail Dialog */}
      <Dialog open={showExpenseDetailDialog} onOpenChange={setShowExpenseDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedExpense?.description || "Expense Details"}</DialogTitle>
            <DialogDescription>
              {selectedExpense?.date.toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {isLoadingExplanation ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
              </div>
            ) : expenseExplanation ? (
              <Alert className="bg-base-blue/5 border-base-blue/20">
                <AlertDescription>{expenseExplanation}</AlertDescription>
              </Alert>
            ) : null}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Amount</p>
                <p>{formatCurrency(selectedExpense?.amount || 0, selectedExpense?.currency as any)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Paid By</p>
                <p>{selectedExpense?.paidByName || "Unknown"}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Category</p>
                <p>{selectedExpense?.category || "Uncategorized"}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Date</p>
                <p>{selectedExpense?.date.toLocaleDateString()}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Split Details</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedExpense?.splitBetween?.map((split: any, index: number) => (
                  <div key={index} className="flex items-center justify-between border-b border-border pb-1.5">
                    <span>{split.userName}</span>
                    <span>{formatCurrency(split.amount, selectedExpense?.currency as any)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
