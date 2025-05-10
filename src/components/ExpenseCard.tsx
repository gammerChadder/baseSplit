import React from "react";
import { formatCurrency, dateFormatter } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";

interface ExpenseCardProps {
  expense: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    date: Date;
    paidBy: string;
    paidByName: string;
    category?: string;
    settlements?: Array<{
      payerId: string;
      receiverId: string;
      status: string;
      transactionHash?: string;
    }>;
    splitBetween: Array<{
      userId: string;
      userName: string;
      amount: number;
    }>;
  };
  currentUserId?: string;
  onClick?: () => void;
}

const categoryColorMap: Record<string, string> = {
  "Food & Drinks": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "Transportation": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "Accommodation": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  "Shopping": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  "Entertainment": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  "Utilities": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  "Medical": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  "Travel": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  "Other": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

export function ExpenseCard({ expense, currentUserId, onClick }: ExpenseCardProps) {
  const navigate = useNavigate();
  const { transactions } = useApp();
  
  // Find the most up-to-date version of this expense in transactions
  const updatedExpense = transactions.find(t => t.id === expense.id) || expense;
  
  // Safely handle the date to ensure it's a valid Date object
  const safeDate = (() => {
    try {
      // Check if date exists and has a toDate method (Firestore Timestamp)
      if (updatedExpense.date && typeof updatedExpense.date.toDate === 'function') {
        return updatedExpense.date.toDate();
      } 
      // If it's already a Date object
      else if (updatedExpense.date instanceof Date) {
        return updatedExpense.date;
      } 
      // Try to create a new Date from the value if it exists
      else if (updatedExpense.date) {
        const parsedDate = new Date(updatedExpense.date);
        return !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      }
      // Default to current date if all else fails
      return new Date();
    } catch (e) {
      return new Date();
    }
  })();
  
  // Check if the current user paid for this expense
  const isPayer = currentUserId && updatedExpense.paidBy === currentUserId;
  
  // Check if the current user has already paid this expense
  const hasAlreadyPaid = currentUserId && updatedExpense.settlements?.some(
    settlement => 
      settlement.payerId === currentUserId && 
      settlement.status === "completed" // Make sure to check for "completed" status
  );
  
  // Calculate what the current user owes or is owed
  const currentUserSplit = currentUserId 
    ? updatedExpense.splitBetween.find(split => split.userId === currentUserId)
    : null;
  
  const userStatus = isPayer
    ? "You paid"
    : hasAlreadyPaid
      ? "You paid"
      : currentUserSplit
        ? "You owe"
        : "";
  
  const userAmount = isPayer 
    ? updatedExpense.amount 
    : currentUserSplit 
      ? currentUserSplit.amount 
      : 0;

  const getInitials = (name: string | undefined) => {
    // Add null check to prevent the error
    if (!name) return "??";
    return name.slice(0, 2).toUpperCase();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/expenses/${updatedExpense.id}`);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer overflow-hidden",
        onClick && "hover:-translate-y-1"
      )}
      onClick={handleCardClick}
    >
      <div className="h-1.5 w-full bg-base-gradient"></div>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-base-blue text-white">
                {getInitials(updatedExpense.paidByName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base font-medium">
                {updatedExpense.description}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {dateFormatter.format(safeDate)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              {formatCurrency(updatedExpense.amount, updatedExpense.currency as any)}
            </p>
            {currentUserId && (
              <p className={cn(
                "text-xs font-medium",
                isPayer || hasAlreadyPaid 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                {userStatus} {formatCurrency(userAmount, updatedExpense.currency as any)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-between items-center pt-2">
          <div className="flex gap-1.5">
            {updatedExpense.category && (
              <Badge variant="outline" className={categoryColorMap[updatedExpense.category] || ""}>
                {updatedExpense.category}
              </Badge>
            )}
            {currentUserId && !isPayer && hasAlreadyPaid && (
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Paid
              </Badge>
            )}
          </div>
          <div className="flex -space-x-2">
            {updatedExpense.splitBetween?.slice(0, 3).map((person) => (
              <Tooltip key={person.userId}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className={cn(
                      "text-xs",
                      (person.userId === currentUserId && (hasAlreadyPaid || isPayer)) || 
                      (person.userId === updatedExpense.paidBy)
                        ? "bg-green-500 text-white" 
                        : "bg-accent"
                    )}>
                      {getInitials(person.userName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {person.userName} 
                    {person.userId === updatedExpense.paidBy ? " (Paid for all)" : ""}
                    {person.userId === currentUserId && hasAlreadyPaid ? " (Paid)" : ""}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
            {updatedExpense.splitBetween && updatedExpense.splitBetween.length > 3 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-xs bg-muted">
                      +{updatedExpense.splitBetween.length - 3}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{updatedExpense.splitBetween.length - 3} more people</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
