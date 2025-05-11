
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/hooks/use-toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY_SYMBOLS = {
  USD: "$",
  INR: "₹",
  GBP: "£",
  EUR: "€",
  ETH: "Ξ",
};

export const CURRENCY_RATES = {
  USD: 2243.52,
  INR: 192065.03, // Using the value you specified
  GBP: 1694.35,
  EUR: 1994.49,
  ETH: 1, // 1 ETH = 1 ETH
};

export function formatCurrency(amount: number, currency: keyof typeof CURRENCY_SYMBOLS = "USD") {
  const symbol = CURRENCY_SYMBOLS[currency];
  return `${symbol}${amount.toFixed(2)}`;
}

export function convertCurrency(amount: number, fromCurrency: keyof typeof CURRENCY_RATES, toCurrency: keyof typeof CURRENCY_RATES) {
  // Convert from source currency to ETH first
  const amountInEth = amount / CURRENCY_RATES[fromCurrency];
  // Then convert from ETH to target currency
  return amountInEth * CURRENCY_RATES[toCurrency];
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function displayToast(title: string, description: string, type: "success" | "error" | "info" = "info") {
  toast({
    title,
    description,
    variant: type === "error" ? "destructive" : "default",
  });
}

export const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function groupBy<T>(array: T[], key: (item: T) => string) {
  return array.reduce((result, item) => {
    const groupKey = key(item);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}