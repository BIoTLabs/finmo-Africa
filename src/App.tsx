import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Send from "./pages/Send";
import Settings from "./pages/Settings";
import Receive from "./pages/Receive";
import TransactionDetails from "./pages/TransactionDetails";
import AddFunds from "./pages/AddFunds";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import P2P from "./pages/P2P";
import VirtualCard from "./pages/VirtualCard";
import P2PCreateListing from "./pages/P2PCreateListing";
import VirtualCardCreate from "./pages/VirtualCardCreate";
import VirtualCardFund from "./pages/VirtualCardFund";
import PaymentMethods from "./pages/PaymentMethods";
import P2POrderDetail from "./pages/P2POrderDetail";
import P2POrderStatus from "./pages/P2POrderStatus";
import VirtualCardTransactions from "./pages/VirtualCardTransactions";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/send" element={<ProtectedRoute><Send /></ProtectedRoute>} />
        <Route path="/receive" element={<ProtectedRoute><Receive /></ProtectedRoute>} />
        <Route path="/add-funds" element={<ProtectedRoute><AddFunds /></ProtectedRoute>} />
        <Route path="/transaction/:id" element={<ProtectedRoute><TransactionDetails /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/p2p" element={<ProtectedRoute><P2P /></ProtectedRoute>} />
        <Route path="/p2p/create-listing" element={<ProtectedRoute><P2PCreateListing /></ProtectedRoute>} />
        <Route path="/virtual-card" element={<ProtectedRoute><VirtualCard /></ProtectedRoute>} />
        <Route path="/virtual-card/create" element={<ProtectedRoute><VirtualCardCreate /></ProtectedRoute>} />
        <Route path="/virtual-card/:cardId/fund" element={<ProtectedRoute><VirtualCardFund /></ProtectedRoute>} />
        <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
        <Route path="/p2p/order/:listingId" element={<ProtectedRoute><P2POrderDetail /></ProtectedRoute>} />
        <Route path="/p2p/order-status/:orderId" element={<ProtectedRoute><P2POrderStatus /></ProtectedRoute>} />
        <Route path="/virtual-card/:cardId/transactions" element={<ProtectedRoute><VirtualCardTransactions /></ProtectedRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
