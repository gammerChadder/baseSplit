import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseCard } from "@/components/ExpenseCard";
import { getUserTransactions, getUserProfile, ensureAuthenticated } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeDollarSign, Plus, Search, Filter } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Transaction } from "@/types";

const categories = [
  "All",
  "Food & Drinks",
  "Transportation",
  "Accommodation",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Medical",
  "Travel",
  "Other",
];

export default function Expenses() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  useEffect(() => {
    if (user) {
      const fetchTransactions = async () => {
        try {
          // Ensure authentication before fetching data
          await ensureAuthenticated(user.walletAddress);
          const userTransactions = await getUserTransactions(user.id);
          
          // Enhance transactions with payer names
          const enhancedTransactions = [];
          for (const transaction of userTransactions) {
            let paidByName = "Unknown";
            
            // Get payer name
            if (transaction.paidBy === user.id) {
              paidByName = user.displayName;
            } else {
              try {
                const payerProfile = await getUserProfile(transaction.paidBy) as User | null;
                if (payerProfile) {
                  paidByName = payerProfile.displayName;
                }
              } catch (error) {
                console.error("Error fetching payer profile:", error);
              }
            }
            
            // Enhance split data
            const enhancedSplitBetween = [];
            for (const split of transaction.splitBetween || []) {
              let userName = "Unknown";
              
              if (split.userId === user.id) {
                userName = user.displayName;
              } else {
                try {
                  const userProfile = await getUserProfile(split.userId) as User | null;
                  if (userProfile) {
                    userName = userProfile.displayName;
                  }
                } catch (error) {
                  console.error("Error fetching user profile for split:", error);
                }
              }
              
              enhancedSplitBetween.push({
                ...split,
                userName,
              });
            }
            
            enhancedTransactions.push({
              ...transaction,
              paidByName,
              splitBetween: enhancedSplitBetween,
              date: transaction.date?.toDate() || new Date(),
            });
          }
          
          setTransactions(enhancedTransactions);
        } catch (error) {
          console.error("Error fetching transactions:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchTransactions();
    }
  }, [user]);

  const handleSortChange = (value: string) => {
    if (value === "dateAsc") {
      setSortBy("date");
      setSortDirection("asc");
    } else if (value === "dateDesc") {
      setSortBy("date");
      setSortDirection("desc");
    } else if (value === "amountAsc") {
      setSortBy("amount");
      setSortDirection("asc");
    } else if (value === "amountDesc") {
      setSortBy("amount");
      setSortDirection("desc");
    }
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || transaction.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return sortDirection === "asc" 
          ? a.date.getTime() - b.date.getTime()
          : b.date.getTime() - a.date.getTime();
      } else {
        return sortDirection === "asc"
          ? a.amount - b.amount
          : b.amount - a.amount;
      }
    });

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground">
              Manage and track all your expenses
            </p>
          </div>
          <Button onClick={() => navigate("/expenses/add")}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search expenses..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" /> 
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    onClick={() => handleSortChange("dateDesc")}
                    className={sortBy === "date" && sortDirection === "desc" ? "bg-accent" : ""}
                  >
                    Date (Newest First)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSortChange("dateAsc")}
                    className={sortBy === "date" && sortDirection === "asc" ? "bg-accent" : ""}
                  >
                    Date (Oldest First)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSortChange("amountDesc")}
                    className={sortBy === "amount" && sortDirection === "desc" ? "bg-accent" : ""}
                  >
                    Amount (Highest First)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleSortChange("amountAsc")}
                    className={sortBy === "amount" && sortDirection === "asc" ? "bg-accent" : ""}
                  >
                    Amount (Lowest First)
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : filteredAndSortedTransactions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedTransactions.map((transaction) => (
              <ExpenseCard
                key={transaction.id}
                expense={{
                  id: transaction.id,
                  description: transaction.description,
                  amount: transaction.amount,
                  currency: transaction.currency,
                  date: transaction.date,
                  paidBy: transaction.paidBy,
                  paidByName: transaction.paidByName,
                  category: transaction.category,
                  splitBetween: transaction.splitBetween,
                }}
                currentUserId={user.id}
                onClick={() => navigate(`/expenses/${transaction.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <BadgeDollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No Expenses Found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {searchQuery || selectedCategory !== "All"
                ? "No expenses match your search filters."
                : "You haven't created any expenses yet."}
            </p>
            {!searchQuery && selectedCategory === "All" && (
              <Button onClick={() => navigate("/expenses/add")}>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
