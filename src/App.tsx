import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoadingScreen from "@/components/LoadingScreen";

// Eagerly loaded routes (critical path)
import RootRedirect from "./components/RootRedirect";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy loaded routes - User pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Send = lazy(() => import('./pages/Send'));
const Settings = lazy(() => import('./pages/Settings'));
const Receive = lazy(() => import('./pages/Receive'));
const TransactionDetails = lazy(() => import('./pages/TransactionDetails'));
const AddFunds = lazy(() => import('./pages/AddFunds'));
const Profile = lazy(() => import('./pages/Profile'));
const P2P = lazy(() => import('./pages/P2P'));
const P2PCreateListing = lazy(() => import('./pages/P2PCreateListing'));
const P2POrderDetail = lazy(() => import('./pages/P2POrderDetail'));
const P2POrderStatus = lazy(() => import('./pages/P2POrderStatus'));
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'));
const RequestPayment = lazy(() => import('./pages/RequestPayment'));
const PaymentRequest = lazy(() => import('./pages/PaymentRequest'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const AllTransactions = lazy(() => import('./pages/AllTransactions'));
const Explorer = lazy(() => import('./pages/Explorer'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const MarketplaceCreate = lazy(() => import('./pages/MarketplaceCreate'));
const MarketplaceListing = lazy(() => import('./pages/MarketplaceListing'));
const MarketplaceListingBids = lazy(() => import('./pages/MarketplaceListingBids'));
const MarketplaceOrders = lazy(() => import('./pages/MarketplaceOrders'));
const MarketplaceOrderDetail = lazy(() => import('./pages/MarketplaceOrderDetail'));
const KYCVerification = lazy(() => import('./pages/KYCVerification'));
const AccountStatement = lazy(() => import('./pages/AccountStatement'));
const MyAds = lazy(() => import('./pages/MyAds'));
const Staking = lazy(() => import('./pages/Staking'));
const Rewards = lazy(() => import('./pages/Rewards'));
const RewardsDetails = lazy(() => import('./pages/RewardsDetails'));

// Lazy loaded routes - Virtual Card (Coming Soon)
const ComingSoon = lazy(() => import('./pages/ComingSoon'));

// Lazy loaded routes - Auth & Account
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PhoneVerification = lazy(() => import('./pages/PhoneVerification'));
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Lazy loaded routes - Admin pages (heavy, rarely accessed)
const Admin = lazy(() => import('./pages/Admin'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminRewardsBackfill = lazy(() => import('./pages/AdminRewardsBackfill'));
const AdminKYC = lazy(() => import('./pages/AdminKYC'));
const AdminListings = lazy(() => import('./pages/AdminListings'));
const AdminMessaging = lazy(() => import('./pages/AdminMessaging'));
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'));
const AdminUserDeletion = lazy(() => import('./pages/AdminUserDeletion'));
const AdminUserManagement = lazy(() => import('./pages/AdminUserManagement'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const AdminPartnerManagement = lazy(() => import('./pages/AdminPartnerManagement'));
const AdminRevenue = lazy(() => import('./pages/AdminRevenue'));
const AdminStakingReserves = lazy(() => import('./pages/AdminStakingReserves'));
const AdminCountries = lazy(() => import('./pages/AdminCountries'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));

// Lazy loaded routes - Partner pages
const PartnerRegister = lazy(() => import('./pages/PartnerRegister'));
const PartnerPricing = lazy(() => import('./pages/PartnerPricing'));
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (previously cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-phone" element={<PhoneVerification />} />
            <Route path="/phone-verification" element={<PhoneVerification />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/all-transactions" element={<ProtectedRoute><AllTransactions /></ProtectedRoute>} />
            <Route path="/explorer" element={<ProtectedRoute><Explorer /></ProtectedRoute>} />
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
            <Route path="/virtual-card" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/virtual-card/create" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/virtual-card/:cardId/fund" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethods /></ProtectedRoute>} />
            <Route path="/p2p/order/:listingId" element={<ProtectedRoute><P2POrderDetail /></ProtectedRoute>} />
            <Route path="/p2p/order-status/:orderId" element={<ProtectedRoute><P2POrderStatus /></ProtectedRoute>} />
            <Route path="/virtual-card/:cardId/transactions" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/request-payment" element={<ProtectedRoute><RequestPayment /></ProtectedRoute>} />
            <Route path="/payment-history" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
            <Route path="/pay/:id" element={<PaymentRequest />} />
            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/marketplace/create" element={<ProtectedRoute><MarketplaceCreate /></ProtectedRoute>} />
            <Route path="/marketplace/listing/:id" element={<ProtectedRoute><MarketplaceListing /></ProtectedRoute>} />
            <Route path="/marketplace/listing/:id/bids" element={<ProtectedRoute><MarketplaceListingBids /></ProtectedRoute>} />
            <Route path="/marketplace/listing/:id/edit" element={<ProtectedRoute><MarketplaceCreate /></ProtectedRoute>} />
            <Route path="/marketplace/orders" element={<ProtectedRoute><MarketplaceOrders /></ProtectedRoute>} />
            <Route path="/marketplace/order/:id" element={<ProtectedRoute><MarketplaceOrderDetail /></ProtectedRoute>} />
            <Route path="/kyc-verification" element={<ProtectedRoute><KYCVerification /></ProtectedRoute>} />
            <Route path="/account-statement" element={<ProtectedRoute><AccountStatement /></ProtectedRoute>} />
            <Route path="/my-ads" element={<ProtectedRoute><MyAds /></ProtectedRoute>} />
            <Route path="/staking" element={<ProtectedRoute><Staking /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/rewards/details" element={<ProtectedRoute><RewardsDetails /></ProtectedRoute>} />
            <Route path="/admin/rewards-backfill" element={<ProtectedRoute><AdminRewardsBackfill /></ProtectedRoute>} />
            <Route path="/admin/kyc" element={<ProtectedRoute><AdminKYC /></ProtectedRoute>} />
            <Route path="/admin/listings" element={<ProtectedRoute><AdminListings /></ProtectedRoute>} />
            <Route path="/admin/messaging" element={<ProtectedRoute><AdminMessaging /></ProtectedRoute>} />
            <Route path="/admin/disputes" element={<ProtectedRoute><AdminDisputes /></ProtectedRoute>} />
            <Route path="/admin/user-deletion" element={<ProtectedRoute><AdminUserDeletion /></ProtectedRoute>} />
            <Route path="/admin/user-management" element={<ProtectedRoute><AdminUserManagement /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute><AdminAuditLogs /></ProtectedRoute>} />
            <Route path="/admin/partners" element={<ProtectedRoute><AdminPartnerManagement /></ProtectedRoute>} />
            <Route path="/admin/revenue" element={<ProtectedRoute><AdminRevenue /></ProtectedRoute>} />
            <Route path="/admin/staking-reserves" element={<ProtectedRoute><AdminStakingReserves /></ProtectedRoute>} />
            <Route path="/admin/countries" element={<ProtectedRoute><AdminCountries /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/partner/register" element={<PartnerRegister />} />
            <Route path="/partner/pricing" element={<PartnerPricing />} />
            <Route path="/partner/dashboard" element={<PartnerDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;