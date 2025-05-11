// types/index.ts
import { Timestamp } from "firebase/firestore";

export type AllowedCurrency = "USD" | "INR" | "GBP" | "EUR" | "ETH";

export interface User {
  id: string;
  walletAddress: string;
  displayName: string;
  defaultCurrency: AllowedCurrency;
  groups?: Array<{ groupId: string; role: string }>;
  balance?: string;
  usdcBalance?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  creator: string;
  members: string[];
  defaultCurrency: AllowedCurrency;
  expenses: Expense[];
  totalExpenses: number;
  createdAt?: any;
  memberDetails?: Record<string, { name: string, displayName?: string }>;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: AllowedCurrency;
  paidBy: string;
  paidByName?: string;
  splitBetween: SplitUser[];
  date: Date;
  category?: string;
  createdAt?: any;
}

export interface SplitUser {
  userId: string;
  userName?: string;
  amount: number;
}

// Add Settlement interface
export interface Settlement {
  payerId: string;
  receiverId: string;
  amount: number;
  currency: AllowedCurrency;
  expenseId: string;
  transactionHash?: string;
  status: "pending" | "completed";
  createdAt?: any;
  paymentMethod?: "eth" | "usdc";
}

// Update your Transaction interface to include settlements
export interface Transaction {
  id: string;
  groupId?: string;
  expenseId?: string;
  description: string;
  amount: number;
  currency: AllowedCurrency;
  paidBy: string;
  paidByName?: string;
  splitBetween: Array<{
    userId: string;
    userName: string;
    amount: number;
  }>;
  date: Date | any;
  category?: string;
  status?: string;
  memberDetails?: Record<string, { name: string; avatar?: string }>;
  settlements?: Settlement[];
  createdAt?: any;
}