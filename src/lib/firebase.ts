import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile
} from "firebase/auth";
import { User, Transaction, Expense } from "@/types";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEhh30O0GsHfKZwUiFXH7y1kb5MEqX8kw",
  authDomain: "splitwise-base.firebaseapp.com",
  projectId: "splitwise-base",
  storageBucket: "splitwise-base.firebasestorage.app",
  messagingSenderId: "940722535552",
  appId: "1:940722535552:web:9772acedbfcc3add48ba65"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enhanced authentication function
export const ensureAuthenticated = async (walletAddress = null) => {
  try {
    // Check if user is already authenticated
    if (auth.currentUser) {
      return true;
    }
    
    // If not authenticated, sign in anonymously
    const userCredential = await signInAnonymously(auth);
    
    // If wallet address is provided, update the user profile
    if (walletAddress && auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: walletAddress.slice(0, 6)
      });
    }
    
    console.log("Successfully authenticated with Firebase");
    return true;
  } catch (error) {
    console.error("Authentication error:", error);
    return false;
  }
};

// User functions
export const createUserProfile = async (walletAddress, displayName = "") => {
  try {
    // Ensure Firebase authentication with wallet address
    await ensureAuthenticated(walletAddress);
    
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("walletAddress", "==", walletAddress));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      const userDoc = await addDoc(usersRef, {
        walletAddress,
        displayName: displayName || walletAddress.slice(0, 6),
        createdAt: serverTimestamp(),
        defaultCurrency: "USD",
        groups: [],
      });
      
      return { id: userDoc.id, walletAddress, displayName: displayName || walletAddress.slice(0, 6), defaultCurrency: "USD" };
    } else {
      return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
    }
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

export const updateUserProfile = async (userId, data) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

export const getUserProfile = async (userIdentifier) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const usersRef = collection(db, "users");
    let querySnapshot;
    
    // Check if the identifier is a wallet address or user ID
    if (userIdentifier.startsWith("0x")) {
      // It's a wallet address
      const q = query(usersRef, where("walletAddress", "==", userIdentifier));
      querySnapshot = await getDocs(q);
    } else {
      // It's a user ID
      const userDoc = await getDoc(doc(db, "users", userIdentifier));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
      }
      return null;
    }
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return { id: querySnapshot.docs[0].id, ...userData };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

// Update transaction status in the transactions collection
export const updateTransactionStatus = async (transactionId, userId, settlementData) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const transactionRef = doc(db, "transactions", transactionId);
    const transactionDoc = await getDoc(transactionRef);
    
    if (transactionDoc.exists()) {
      const transactionData = transactionDoc.data();
      
      // Add or update the settlements array
      let settlements = transactionData.settlements || [];
      
      // Check if this user already has a settlement record
      const existingSettlementIndex = settlements.findIndex(s => s.payerId === userId);
      
      if (existingSettlementIndex >= 0) {
        // Update existing settlement
        settlements[existingSettlementIndex] = {
          ...settlements[existingSettlementIndex],
          ...settlementData
        };
      } else {
        // Add new settlement
        settlements.push(settlementData);
      }
      
      // Update the transaction with the new settlements array
      await updateDoc(transactionRef, {
        settlements,
        lastUpdatedAt: serverTimestamp()
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error updating transaction status:", error);
    throw error;
  }
};

// Group functions
export const createGroup = async (data) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const groupsRef = collection(db, "groups");
    const groupDoc = await addDoc(groupsRef, {
      ...data,
      expenses: [],
      totalExpenses: 0,
      createdAt: serverTimestamp(),
    });
    
    // Add group to user's groups
    for (const memberId of data.members) {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("walletAddress", "==", memberId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const groups = userData.groups || [];
        
        await updateDoc(doc(db, "users", userDoc.id), {
          groups: [...groups, { groupId: groupDoc.id, role: memberId === data.creator ? 'admin' : 'member' }],
        });
      }
    }
    
    return { id: groupDoc.id, ...data };
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

export const getGroup = async (groupId) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const groupRef = doc(db, "groups", groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (groupDoc.exists()) {
      return { id: groupDoc.id, ...groupDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting group:", error);
    throw error;
  }
};

export const getUserGroups = async (userId) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const groups = userData.groups || [];
      
      const groupDetails = [];
      for (const groupRef of groups) {
        const groupDoc = await getDoc(doc(db, "groups", groupRef.groupId));
        if (groupDoc.exists()) {
          groupDetails.push({
            id: groupDoc.id,
            ...groupDoc.data(),
            userRole: groupRef.role,
          });
        }
      }
      
      return groupDetails;
    }
    return [];
  } catch (error) {
    console.error("Error getting user groups:", error);
    throw error;
  }
};

// Expense functions
export const createExpense = async (groupId, data) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const groupRef = doc(db, "groups", groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (groupDoc.exists()) {
      const groupData = groupDoc.data();
      const expenses = groupData.expenses || [];
      
      // Remove serverTimestamp() from inside the expense object
      const newExpense = {
        ...data,
        id: `exp_${Date.now()}`,
        date: Timestamp.fromDate(data.date),
        // Remove createdAt: serverTimestamp() from here
      };
      
      const updatedExpenses = [...expenses, newExpense];
      
      await updateDoc(groupRef, {
        expenses: updatedExpenses,
        totalExpenses: groupData.totalExpenses + data.amount,
        lastUpdatedAt: serverTimestamp(), // Add the timestamp to the group document directly instead
      });
      
      // Create transaction records
      const transactionsRef = collection(db, "transactions");
      await addDoc(transactionsRef, {
        groupId,
        expenseId: newExpense.id,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        paidBy: data.paidBy,
        splitBetween: data.splitBetween,
        date: data.date,
        status: "pending",
        createdAt: serverTimestamp(), // This is fine because it's not inside an array
      });
      
      return newExpense;
    }
    return null;
  } catch (error) {
    console.error("Error creating expense:", error);
    throw error;
  }
};

export const getUserTransactions = async (userId) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const transactionsRef = collection(db, "transactions");
    const q = query(
      transactionsRef, 
      where("paidBy", "==", userId)
    );
    const paidByQuerySnapshot = await getDocs(q);
    
    // We need to modify this query since array-contains only works with primitive values
    // Let's fetch all transactions and filter in code
    const allTransactionsSnapshot = await getDocs(transactionsRef);
    
    const transactions = [
      ...paidByQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    ];
    
    // Manually filter transactions where user is in splitBetween
    allTransactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.splitBetween && data.splitBetween.some(split => split.userId === userId)) {
        // Avoid duplicates
        if (!transactions.some(t => t.id === doc.id)) {
          transactions.push({ id: doc.id, ...data });
        }
      }
    });
    
    return transactions as Transaction[];
  } catch (error) {
    console.error("Error getting user transactions:", error);
    throw error;
  }
};

// Settlement functions
export const recordSettlement = async (data) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const settlementsRef = collection(db, "settlements");
    const settlementDoc = await addDoc(settlementsRef, {
      ...data,
      status: data.transactionHash ? "completed" : "pending",
      createdAt: serverTimestamp(),
    });
    
    return { id: settlementDoc.id, ...data };
  } catch (error) {
    console.error("Error recording settlement:", error);
    throw error;
  }
};

export const updateSettlementStatus = async (settlementId, transactionHash) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    const settlementRef = doc(db, "settlements", settlementId);
    await updateDoc(settlementRef, {
      transactionHash,
      status: "completed",
      completedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating settlement status:", error);
    throw error;
  }
};

interface Balance {
  amount: number;
  currency: string;
}

interface SettlementData {
  id: string;
  payerId: string;
  receiverId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed";
  transactionHash?: string;
}

export const getUserBalances = async (userId) => {
  try {
    // Ensure Firebase authentication
    await ensureAuthenticated();
    
    // Explicitly type the transactions as Transaction[]
    const userTransactions = await getUserTransactions(userId) as Transaction[];
    
    const settlementsRef = collection(db, "settlements");
    const payerQ = query(settlementsRef, where("payerId", "==", userId));
    const payerQuerySnapshot = await getDocs(payerQ);
    
    const receiverQ = query(settlementsRef, where("receiverId", "==", userId));
    const receiverQuerySnapshot = await getDocs(receiverQ);
    
    // Use SettlementData interface for settlements
    const settlements = [
      ...payerQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementData)),
      ...receiverQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementData))
    ];
    
    // Calculate balances
    const balances: Record<string, Balance> = {};
    
    // Add transaction balances
    userTransactions.forEach((transaction) => {
      const isPayer = transaction.paidBy === userId;
      
      if (isPayer) {
        // User paid, others owe them
        transaction.splitBetween.forEach((split) => {
          if (split.userId !== userId) {
            if (!balances[split.userId]) {
              balances[split.userId] = { amount: 0, currency: transaction.currency };
            }
            balances[split.userId].amount += split.amount;
          }
        });
      } else {
        // User owes the payer
        const userSplit = transaction.splitBetween.find((split) => split.userId === userId);
        if (userSplit) {
          if (!balances[transaction.paidBy]) {
            balances[transaction.paidBy] = { amount: 0, currency: transaction.currency };
          }
          balances[transaction.paidBy].amount -= userSplit.amount;
        }
      }
    });
    
    // Subtract settlement amounts
    settlements.forEach((settlement) => {
      if (settlement.status === "completed") {
        if (settlement.payerId === userId) {
          // User paid
          if (!balances[settlement.receiverId]) {
            balances[settlement.receiverId] = { amount: 0, currency: settlement.currency };
          }
          balances[settlement.receiverId].amount -= settlement.amount;
        } else {
          // User received
          if (!balances[settlement.payerId]) {
            balances[settlement.payerId] = { amount: 0, currency: settlement.currency };
          }
          balances[settlement.payerId].amount += settlement.amount;
        }
      }
    });
    
    return balances;
  } catch (error) {
    console.error("Error calculating user balances:", error);
    throw error;
  }
};

// Helper for AI suggestions
export const getBudgetSuggestions = async (data) => {
  try {
    // For now, return a simple suggestion based on the data provided
    // In a real implementation, this would connect to an AI service
    let suggestion = "Based on your spending patterns:\n\n";
    
    const currentMonthTotal = data.currentMonth.total;
    const previousMonthTotal = data.previousMonth.total;
    
    if (currentMonthTotal > 0) {
      const topCategory = Object.entries(data.currentMonth.spent)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .shift();
      
      if (topCategory) {
        suggestion += `- Your highest spending category is ${topCategory[0]} at ${topCategory[1]} ${data.transactions[0]?.currency || 'USD'}.\n`;
      }
      
      if (previousMonthTotal > 0) {
        const percentChange = ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
        if (percentChange > 10) {
          suggestion += `- Your spending has increased by ${percentChange.toFixed(0)}% compared to last month.\n`;
        } else if (percentChange < -10) {
          suggestion += `- Great job! You've reduced your spending by ${Math.abs(percentChange).toFixed(0)}% compared to last month.\n`;
        } else {
          suggestion += `- Your spending is consistent with last month (${percentChange.toFixed(0)}% difference).\n`;
        }
      }
      
      suggestion += "\nRecommendations:\n";
      suggestion += "- Consider setting a budget limit for your highest spending category.\n";
      suggestion += "- Review your recurring subscriptions and services for potential savings.\n";
      suggestion += "- Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings or debt repayment.";
    } else {
      suggestion = "Add your first expense to get personalized budget insights!";
    }
    
    return suggestion;
  } catch (error) {
    console.error("Error generating budget suggestions:", error);
    return "Unable to generate budget suggestions at this time.";
  }
};