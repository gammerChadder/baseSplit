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
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [showExpenseDetailDialog, setShowExpenseDetailDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseExplanation, setExpenseExplanation] = useState("");
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
            const splitBetween = expense.splitBetween.map((split: any) => {
              const splitUser = memberDetails.find((member) => member.id === split.userId);
              return {
                ...split,
                userName: splitUser?.displayName || "Unknown",
              };
            });

            return {
              ...expense,
              date: expense.date?.toDate() || new Date(),
              paidByName: paidByUser?.displayName || "Unknown",
              splitBetween,
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
        members.forEach((member) => {
          newSplitValues[member.id] = equalShare.toFixed(2);
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
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold ml-2">
          {isLoading ? <Skeleton className="h-8 w-48" /> : group?.name}
        </h1>
      </div>

      {!isLoading && group?.description && (
        <p className="text-muted-foreground mb-6">
          {group.description}
        </p>
      )}

      <div className="flex justify-end mb-6">
        <Button onClick={handleShowAddExpenseDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full mb-6" />
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BadgeDollarSign className="mr-2 h-5 w-5" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(group?.totalExpenses || 0, group?.defaultCurrency as any)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Default currency: {group?.defaultCurrency || "USD"}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <Badge key={member.id} variant="outline" className="flex items-center gap-2 p-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback>{member.displayName ? member.displayName.slice(0, 2).toUpperCase() : 'XX'}</AvatarFallback>
                </Avatar>
                {member.displayName}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Activities</CardTitle>
            <p className="text-sm text-muted-foreground">
              {expenses.length}
              <span className="ml-1">Total expenses recorded</span>
            </p>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="mb-4">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : expenses.length > 0 ? (
            <div className="space-y-4">
              {expenses
                .sort((a, b) => b.date - a.date)
                .map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onClick={() => handleShowExpenseDetails(expense)}
                  />
                ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">No Expenses Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first expense to start tracking
              </p>
              <Button onClick={handleShowAddExpenseDialog}>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="members">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{member.displayName ? member.displayName.slice(0, 2).toUpperCase() : 'XX'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.displayName}</div>
                      <Badge variant="outline">
                        {member.id === group.creator ? "Admin" : "Member"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <h3 className="text-lg font-semibold">No members found</h3>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense to split with the group
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newExpenseForm.description}
                onChange={handleExpenseDescriptionChange}
              />
            </div>
            
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={newExpenseForm.amount}
                onChange={(e) => 
                  setNewExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={newExpenseForm.currency}
                onValueChange={(value) => 
                  setNewExpenseForm(prev => ({ ...prev, currency: value }))}
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
            
            <div>
              <Label htmlFor="paidBy">Paid By</Label>
              <Select
                value={newExpenseForm.paidBy}
                onValueChange={(value) => 
                  setNewExpenseForm(prev => ({ ...prev, paidBy: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select who paid" />
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
            
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={newExpenseForm.category}
                onValueChange={(value) => 
                  setNewExpenseForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
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
            
            <div>
              <Label>Split Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant={newExpenseForm.splitType === "equal" ? "default" : "outline"}
                  onClick={() => handleSplitTypeChange("equal")}
                >
                  Split Equally
                </Button>
                <Button
                  type="button"
                  variant={newExpenseForm.splitType === "exact" ? "default" : "outline"}
                  onClick={() => handleSplitTypeChange("exact")}
                >
                  Split by Exact Amounts
                </Button>
              </div>
            </div>
            
            {newExpenseForm.splitType === "exact" && (
              <div>
                <Label>Split Amounts</Label>
                <div className="space-y-2 mt-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <span className="min-w-[120px]">{member.displayName}:</span>
                      <Input
                        type="number"
                        value={newExpenseForm.splitValues[member.id] || ""}
                        onChange={(e) => 
                          handleSplitValueChange(member.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {newExpenseForm.splitType === "equal" && newExpenseForm.amount && (
              <Alert>
                <AlertDescription>
                  <span className="font-semibold">Split Preview</span>: 
                  Each person will pay {formatCurrency(
                    parseFloat(newExpenseForm.amount) / members.length,
                    newExpenseForm.currency as any
                  )}
                </AlertDescription>
              </Alert>
            )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedExpense?.description || "Expense Details"}</DialogTitle>
            <DialogDescription>
              {selectedExpense?.date.toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingExplanation ? (
            <Skeleton className="h-16 w-full" />
          ) : expenseExplanation ? (
            <Alert className="mb-4">
              <AlertDescription>{expenseExplanation}</AlertDescription>
            </Alert>
          ) : null}
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Amount</Label>
              <div className="text-2xl font-bold">
                {formatCurrency(selectedExpense?.amount || 0, selectedExpense?.currency as any)}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Paid By</Label>
              <div>{selectedExpense?.paidByName || "Unknown"}</div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <div>{selectedExpense?.category || "Uncategorized"}</div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Date</Label>
              <div>{selectedExpense?.date.toLocaleDateString()}</div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Split Details</Label>
              <div className="space-y-2 mt-2">
                {selectedExpense?.splitBetween?.map((split: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 border rounded-md">
                    <span>{split.userName}</span>
                    <span className="font-medium">
                      {formatCurrency(split.amount, selectedExpense?.currency as any)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowExpenseDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}