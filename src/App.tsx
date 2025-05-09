import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import Index from "./pages/Index";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import CreateGroup from "./pages/CreateGroup";
import Expenses from "./pages/Expenses";
import ExpenseDetails from "./pages/ExpenseDetails"; // Import the new component
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
            <Route path="/groups/create" element={<CreateGroup />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/:id" element={<ExpenseDetails />} /> {/* Add this new route */}
            <Route path="/expenses/add" element={<GroupDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
