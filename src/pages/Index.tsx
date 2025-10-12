import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Zap, Users, Wallet, ArrowRight, CheckCircle, Shield, 
  CreditCard, TrendingUp, Lock, Smartphone, Globe, 
  ShoppingBag, RefreshCw, FileCheck, Users2, Banknote,
  QrCode, ChevronRight, Mail, Send, Twitter, MessageCircle,
  Phone, Store
} from "lucide-react";
import finmoLogo from "@/assets/finmo-logo.png";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: contactForm
      });

      if (error) throw error;

      toast.success("Message sent successfully! We'll get back to you soon.");
      setContactForm({ name: "", email: "", message: "" });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const features = [
    {
      icon: Phone,
      title: "Send Crypto via Phone Numbers",
      description: "Revolutionary feature: Send cryptocurrency to anyone using just their phone number. No complex wallet addresses needed!",
    },
    {
      icon: Store,
      title: "Goods & Services Marketplace",
      description: "Buy and sell physical goods, digital products, and services with crypto. Complete marketplace with escrow protection.",
    },
    {
      icon: Zap,
      title: "Instant Transfers",
      description: "Send money to FinMo users instantly with zero fees. Real-time balance updates and transaction confirmations.",
    },
    {
      icon: ShoppingBag,
      title: "P2P Crypto Trading",
      description: "Trade cryptocurrencies peer-to-peer with multiple payment methods and built-in escrow for secure transactions.",
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
      icon: Shield,
      title: "Bank-Level Security",
      description: "KYC verification, encrypted payment methods, Row Level Security policies, and secure blockchain technology.",
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
    "Send crypto with just phone numbers - no addresses needed",
    "Marketplace for goods, services & cryptocurrency",
    "Zero fees for FinMo-to-FinMo transfers",
    "Lightning-fast blockchain transactions",
    "P2P trading with escrow protection",
    "Virtual cards for online shopping",
    "Earn rewards through crypto staking",
    "Multi-chain cryptocurrency support",
    "Bank-level security and encryption",
    "KYC-verified user community",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden animate-fade-in bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="relative container mx-auto px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 shadow-finmo-md">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <img src={finmoLogo} alt="FinMo" className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-white">African Crypto Revolution</span>
            </div>
            
            <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl text-foreground">
              Africa's Complete
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-success bg-clip-text text-transparent text-6xl md:text-8xl">
                Crypto Payment Platform
              </span>
            </h1>
            
            <p className="mb-8 text-xl text-muted-foreground leading-relaxed">
              Send crypto using <span className="font-bold text-primary">phone numbers</span>, 
              buy <span className="font-bold text-secondary">goods & services</span> with crypto, 
              trade P2P, create virtual cards, and earn through staking. 
              <span className="block mt-2 text-foreground font-semibold">All in one platform built for Africa.</span>
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-finmo-md text-white text-lg h-14 px-8 font-bold transition-all"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-lg h-14 px-8 border-2 border-primary hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary-glow/10 font-semibold transition-all"
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
          <h2 className="mb-4 text-4xl font-bold text-foreground">
            Revolutionary Features for Africa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Send crypto via <span className="text-primary font-semibold">phone numbers</span> and 
            trade <span className="text-secondary font-semibold">goods & services</span> - plus everything else you need
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card 
              key={feature.title} 
              className="shadow-finmo-md hover:shadow-finmo-lg transition-all hover-scale animate-fade-in border-2 hover:border-primary/50"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-finmo-sm">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Security Features */}
      <div className="bg-muted py-20">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-foreground">
              Enterprise-Grade Security
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your funds and data protected with <span className="text-success font-semibold">blockchain technology</span> and 
              multiple layers of security
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {securityFeatures.map((feature, index) => (
              <Card 
                key={feature.title} 
                className="shadow-finmo-md hover:shadow-finmo-lg transition-all hover-scale animate-fade-in border-2 hover:border-success/50"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-success to-success/80 shadow-finmo-sm">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary-dark py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center text-white">
            <h2 className="mb-4 text-4xl font-bold">Everything You Need in One Platform</h2>
            <p className="mb-12 text-xl leading-relaxed">
              From instant transfers to P2P trading, virtual cards, and staking rewards
            </p>

            <div className="grid gap-4 text-left sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-4 rounded-lg hover:bg-white/20 transition-all">
                  <CheckCircle className="mt-0.5 w-6 h-6 flex-shrink-0" />
                  <p className="text-lg font-medium">{benefit}</p>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="mt-12 bg-white text-primary hover:bg-white/90 text-lg h-14 px-8 font-bold shadow-finmo-md"
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
              icon: Phone,
              title: "Phone Number Payments",
              desc: "Send cryptocurrency to anyone using just their phone number. No wallet addresses, no complexity - just like sending a text message.",
              features: ["Send crypto via phone", "No wallet addresses needed", "Contact sync integration", "QR code payments"],
              gradient: "bg-gradient-to-br from-primary to-primary-glow"
            },
            {
              icon: Store,
              title: "Marketplace Trading",
              desc: "Complete marketplace for buying/selling goods, services, and cryptocurrencies with built-in escrow protection.",
              features: ["Physical goods", "Digital products", "Services marketplace", "Crypto P2P trading"],
              gradient: "bg-gradient-to-br from-secondary to-secondary-dark"
            },
            {
              icon: CreditCard,
              title: "Virtual Cards & Staking",
              desc: "Create instant virtual cards for shopping and earn passive income through flexible staking options.",
              features: ["Instant card creation", "Real-time funding", "Crypto staking rewards", "Multi-chain support"],
              gradient: "bg-gradient-to-br from-success to-primary"
            },
          ].map((useCase, index) => (
            <Card key={useCase.title} className="shadow-finmo-md hover:shadow-finmo-lg transition-all animate-slide-up hover-scale border-2" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardContent className="p-8">
                <div className={`mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl ${useCase.gradient} shadow-finmo-sm`}>
                  <useCase.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="mb-3 text-2xl font-bold">{useCase.title}</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">{useCase.desc}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm font-medium">
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
      <div className="bg-muted/50 py-20">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-foreground">
              Get Started in Minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple onboarding process to start sending and receiving <span className="text-primary font-semibold">crypto payments</span>
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { 
                  step: "1", 
                  title: "Sign Up & Verify", 
                  desc: "Create your account with phone number and complete KYC verification for security",
                  gradient: "bg-gradient-to-br from-primary to-primary-glow"
                },
                { 
                  step: "2", 
                  title: "Get Your Wallet", 
                  desc: "Receive your secure multi-chain wallet address and sync your contacts",
                  gradient: "bg-gradient-to-br from-secondary to-secondary-dark"
                },
                { 
                  step: "3", 
                  title: "Start Using FinMo", 
                  desc: "Send money, trade P2P, create virtual cards, and earn staking rewards",
                  gradient: "bg-gradient-to-br from-success to-primary"
                },
              ].map((item, index) => (
                <div key={item.step} className="text-center animate-slide-up" style={{ animationDelay: `${index * 0.2}s` }}>
                  <div className={`mb-4 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${item.gradient} text-3xl font-bold text-white shadow-finmo-md`}>
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-foreground">
              Get in Touch
            </h2>
            <p className="text-lg text-muted-foreground">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <Card className="shadow-finmo-md border-2">
            <CardContent className="p-8">
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold mb-2">Name</label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-bold mb-2">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-bold mb-2">Message</label>
                  <Textarea
                    id="message"
                    placeholder="Tell us what's on your mind..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                    rows={5}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                  <Send className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="mx-auto max-w-3xl text-white">
            <h2 className="mb-4 text-4xl md:text-5xl font-bold">
              Join the Future of African Payments
            </h2>
            <p className="mb-8 text-xl leading-relaxed">
              Start sending money, trading crypto, and earning rewards today. No hidden fees, no complexity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 text-lg h-14 px-8 font-bold"
              >
                Create Free Account
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="border-2 border-white text-white hover:bg-white/10 text-lg h-14 px-8 font-semibold"
              >
                Sign In Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-muted py-12 border-t">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-finmo-sm">
                <img src={finmoLogo} alt="FinMo" className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-lg text-foreground">FinMo Africa</p>
                <p className="text-sm text-muted-foreground font-medium">Pan-African Crypto Wallet</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <a 
                href="https://x.com/finmoafrica?t=O96XJbpnVrmdAf4kuHLszA&s=09" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-all hover-scale font-medium"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Twitter className="w-5 h-5 text-white" />
                </div>
                <span className="hidden sm:inline">Twitter</span>
              </a>
              <a 
                href="https://t.me/finmoafrica" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-secondary transition-all hover-scale font-medium"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="hidden sm:inline">Telegram</span>
              </a>
              <a 
                href="mailto:adedayo@finmo.africa"
                className="flex items-center gap-2 text-muted-foreground hover:text-success transition-all hover-scale font-medium"
              >
                <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className="hidden sm:inline">Contact</span>
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 FinMo Africa. Powering the future of payments in Africa with blockchain technology.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
