import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Zap, Users, Wallet, ArrowRight, CheckCircle, Shield, 
  CreditCard, TrendingUp, Lock, Smartphone, Globe, 
  ShoppingBag, RefreshCw, FileCheck, Users2, Banknote,
  QrCode, ChevronRight
} from "lucide-react";
import finmoLogo from "@/assets/finmo-logo.png";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Zap,
      title: "Instant Transfers",
      description: "Send money to FinMo users instantly with zero fees using just phone numbers. Real-time balance updates.",
    },
    {
      icon: Shield,
      title: "Bank-Level Security",
      description: "KYC verification, encrypted payment methods, Row Level Security policies, and secure blockchain technology.",
    },
    {
      icon: ShoppingBag,
      title: "P2P Marketplace",
      description: "Buy and sell cryptocurrencies peer-to-peer with escrow protection and secure payment methods.",
    },
    {
      icon: CreditCard,
      title: "Virtual Cards",
      description: "Create instant virtual debit cards for online shopping. Fund, manage, and track spending in real-time.",
    },
    {
      icon: TrendingUp,
      title: "Crypto Staking",
      description: "Earn passive income on your holdings with flexible or locked staking options and competitive APY rates.",
    },
    {
      icon: Globe,
      title: "Multi-Chain Support",
      description: "Access Polygon, Base, and Arbitrum networks. Hold USDC, MATIC, and other popular cryptocurrencies.",
    },
    {
      icon: Smartphone,
      title: "Contact Sync",
      description: "Automatically sync your phone contacts and easily find friends who are already using FinMo.",
    },
    {
      icon: RefreshCw,
      title: "Real-Time Updates",
      description: "Live transaction notifications, automatic balance synchronization, and instant payment confirmations.",
    },
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: "Encrypted Storage",
      description: "All sensitive data including payment methods are encrypted using industry-standard AES-256 encryption.",
    },
    {
      icon: FileCheck,
      title: "KYC Verification",
      description: "Complete identity verification to ensure platform safety and regulatory compliance.",
    },
    {
      icon: Shield,
      title: "Row Level Security",
      description: "Database-level access controls ensure users can only access their own data and transactions.",
    },
    {
      icon: QrCode,
      title: "Secure Payments",
      description: "QR code scanning, payment requests with SMS notifications, and multi-signature wallet support.",
    },
  ];

  const benefits = [
    "Zero fees for FinMo-to-FinMo transfers",
    "Lightning-fast blockchain transactions",
    "Phone number-based payments - no wallet addresses",
    "Buy & sell crypto in P2P marketplace",
    "Virtual cards for online shopping",
    "Earn rewards through staking",
    "Multi-chain cryptocurrency support",
    "Bank-level security and encryption",
    "Real-time balance synchronization",
    "KYC-verified user community",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="relative overflow-hidden animate-fade-in">
        <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>
        <div className="relative container mx-auto px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-success/10 px-5 py-2.5">
              <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                <img src={finmoLogo} alt="FinMo" className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-success">Secure & Fast Mobile Wallet</span>
            </div>
            
            <h1 className="mb-6 text-5xl font-bold leading-tight bg-gradient-primary bg-clip-text text-transparent md:text-6xl">
              Africa's Complete<br />Crypto Payment Platform
            </h1>
            
            <p className="mb-8 text-xl text-muted-foreground">
              Send money instantly, trade P2P, create virtual cards, and earn through staking. 
              All in one secure, KYC-verified platform built for Africa.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-primary hover:opacity-90 text-lg h-14 px-8"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-lg h-14 px-8"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Complete Financial Ecosystem</h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to send, receive, trade, and grow your cryptocurrency
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card 
              key={feature.title} 
              className="shadow-finmo-md hover:shadow-finmo-lg transition-all hover-scale animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Security Features */}
      <div className="bg-muted py-20">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Enterprise-Grade Security</h2>
            <p className="text-lg text-muted-foreground">
              Your funds and data protected with multiple layers of security
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {securityFeatures.map((feature, index) => (
              <Card 
                key={feature.title} 
                className="shadow-finmo-md hover:shadow-finmo-lg transition-all hover-scale animate-fade-in border-2"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
                    <feature.icon className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-primary py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center text-primary-foreground">
            <h2 className="mb-4 text-3xl font-bold">Everything You Need in One Platform</h2>
            <p className="mb-12 text-lg opacity-90">
              From instant transfers to P2P trading, virtual cards, and staking rewards
            </p>

            <div className="grid gap-4 text-left sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 w-5 h-5 flex-shrink-0" />
                  <p className="text-lg opacity-90">{benefit}</p>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="mt-12 bg-white text-primary hover:bg-white/90 text-lg h-14 px-8"
            >
              Start Trading Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="container mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Built for Every Need</h2>
          <p className="text-lg text-muted-foreground">
            Whether you're sending money home, trading crypto, or shopping online
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {[
            {
              icon: Users2,
              title: "Personal Transfers",
              desc: "Send money to friends and family instantly using just their phone number. Zero fees, real-time delivery.",
              features: ["Phone number transfers", "Contact sync", "Payment requests", "QR code payments"]
            },
            {
              icon: Banknote,
              title: "Crypto Trading",
              desc: "Buy and sell cryptocurrencies peer-to-peer with escrow protection and multiple payment methods.",
              features: ["P2P marketplace", "Escrow protection", "Multiple payment methods", "Secure trades"]
            },
            {
              icon: CreditCard,
              title: "Online Shopping",
              desc: "Create instant virtual cards funded from your crypto wallet for safe online shopping anywhere.",
              features: ["Instant card creation", "Real-time funding", "Transaction tracking", "Spending controls"]
            },
          ].map((useCase, index) => (
            <Card key={useCase.title} className="shadow-finmo-md hover:shadow-finmo-lg transition-all animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardContent className="p-8">
                <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-primary">
                  <useCase.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="mb-3 text-2xl font-semibold">{useCase.title}</h3>
                <p className="text-muted-foreground mb-4">{useCase.desc}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted py-20">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Get Started in Minutes</h2>
            <p className="text-lg text-muted-foreground">
              Simple onboarding process to start sending and receiving money
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { 
                  step: "1", 
                  title: "Sign Up & Verify", 
                  desc: "Create your account with phone number and complete KYC verification for security"
                },
                { 
                  step: "2", 
                  title: "Get Your Wallet", 
                  desc: "Receive your secure multi-chain wallet address and sync your contacts"
                },
                { 
                  step: "3", 
                  title: "Start Using FinMo", 
                  desc: "Send money, trade P2P, create virtual cards, and earn staking rewards"
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-primary py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="mx-auto max-w-3xl text-primary-foreground">
            <h2 className="mb-4 text-3xl font-bold">Join the Future of African Payments</h2>
            <p className="mb-8 text-lg opacity-90">
              Start sending money, trading crypto, and earning rewards today. No hidden fees, no complexity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 text-lg h-14 px-8"
              >
                Create Free Account
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="border-white text-white hover:bg-white/10 text-lg h-14 px-8"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
