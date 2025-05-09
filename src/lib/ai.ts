import { displayToast } from "./utils";
import { GoogleGenerativeAI, GenerateContentRequest } from "@google/generative-ai";

const API_KEY = "AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s";
const MODEL_NAME = "gemini-2.0-flash";

// Initialize the Google GenAI client
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

interface TransactionData {
  description: string;
  amount: number;
  date: Date;
  category?: string;
}

interface BudgetData {
  transactions: TransactionData[];
  currentMonth: {
    spent: Record<string, number>;
    total: number;
  };
  previousMonth?: {
    spent: Record<string, number>;
    total: number;
  };
}

export async function getBudgetSuggestions(data: BudgetData) {
  try {
    const prompt = `
  As a professional financial advisor, analyze the following budget data and provide concise, structured insights:
  
  Current Month Total Spent: ${data.currentMonth.total}
  
  Breakdown by Category:
  ${Object.entries(data.currentMonth.spent).map(([category, amount]) => `${category}: ${amount}`).join('\n')}
  
  ${data.previousMonth ? `
  Previous Month Total Spent: ${data.previousMonth.total}
  
  Previous Month Breakdown:
  ${Object.entries(data.previousMonth.spent).map(([category, amount]) => `${category}: ${amount}`).join('\n')}
  ` : ''}
  
  Recent Transactions:
  ${data.transactions.slice(0, 10).map(t => `${t.description}: ${t.amount} (${t.date.toLocaleDateString()})`).join('\n')}
  
  Please provide:
  1. A brief summary of current spending (1-2 sentences)
  2. 2-3 concise, actionable budget recommendations
  3. Notable category changes from last month (if data available)
  
  Format your response with clear section headers and short paragraphs. Avoid using asterisks, bullet points, or excessive formatting. Keep the entire response under 150 words and make it short and avoid any bold or anything make it plain text with proper bullets.
`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });

    return result.response.text();
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    displayToast("AI Suggestion Error", "Could not generate budget insights at this time.", "error");
    return "Sorry, I couldn't analyze your budget data right now. Please try again later.";
  }
}

export async function getExpenseCategorySuggestion(description: string) {
  try {
    const prompt = `
      Based on the expense description "${description}", suggest the most appropriate expense category from the following options:
      - Food & Drinks
      - Transportation
      - Accommodation
      - Shopping
      - Entertainment
      - Utilities
      - Medical
      - Travel
      - Other
      
      Please respond with just the category name.
    `;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });
    
    const suggestedCategory = result.response.text().trim();
    
    // Ensure the category is one of our predefined ones
    const validCategories = [
      'Food & Drinks', 
      'Transportation', 
      'Accommodation', 
      'Shopping', 
      'Entertainment', 
      'Utilities', 
      'Medical', 
      'Travel', 
      'Other'
    ];
    
    if (validCategories.includes(suggestedCategory)) {
      return suggestedCategory;
    }
    
    return 'Other';
  } catch (error) {
    console.error("Error getting category suggestion:", error);
    return 'Other';
  }
}

export async function simplifyExpenseExplanation(groupExpenseData: any) {
  try {
    const prompt = `
      Explain the following group expense in simple terms:
      
      Description: ${groupExpenseData.description}
      Total Amount: ${groupExpenseData.amount} ${groupExpenseData.currency}
      Paid by: ${groupExpenseData.paidByName}
      Date: ${new Date(groupExpenseData.date).toLocaleDateString()}
      
      Split between:
      ${groupExpenseData.splitBetween.map((split: any) => 
        `${split.userName}: ${split.amount} ${groupExpenseData.currency}`
      ).join('\n')}
      
      Please explain in 2-3 simple sentences what this expense was about and how it was split.
    `;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });

    return result.response.text();
  } catch (error) {
    console.error("Error getting expense explanation:", error);
    return `${groupExpenseData.paidByName} paid ${groupExpenseData.amount} ${groupExpenseData.currency} for ${groupExpenseData.description} and split it among ${groupExpenseData.splitBetween.length} people.`;
  }
}