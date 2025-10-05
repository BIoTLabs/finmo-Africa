import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Zap, Users, Wallet, ArrowRight, CheckCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Zap,
      title: "Instant Transfers",
      description: "Send money to FinMo users instantly with zero fees using phone numbers",
    },
    {
      icon: Shield,
      title: "Secure Wallet",
      description: "Your crypto wallet protected with industry-standard security",
    },
    {
      icon: Users,
      title: "Easy Contacts",
      description: "Find friends using phone numbers, no complex wallet addresses needed",
    },
    {
      icon: Wallet,
      title: "Multi-Token Support",
      description: "Hold and transfer USDC, MATIC, and other popular cryptocurrencies",
    },
  ];

  const benefits = [
    "No transaction fees for FinMo-to-FinMo transfers",
    "Lightning-fast transactions in seconds",
    "Simple phone number-based transfers",
    "Secure blockchain technology",
    "Perfect for everyday transactions",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="relative overflow-hidden animate-fade-in">
        <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>
        <div className="relative container mx-auto px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-success">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-semibold">Secure & Fast Mobile Wallet</span>
            </div>
            
            <h1 className="mb-6 text-5xl font-bold leading-tight bg-gradient-primary bg-clip-text text-transparent md:text-6xl">
              Send Money Instantly<br />Across Africa
            </h1>
            
            <p className="mb-8 text-xl text-muted-foreground">
              FinMo makes crypto payments as easy as sending a text message. Zero fees, instant delivery, secure wallets.
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
          <h2 className="mb-4 text-3xl font-bold">Why Choose FinMo?</h2>
          <p className="text-lg text-muted-foreground">
            The easiest way to manage and send cryptocurrency in Africa
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

      {/* Benefits Section */}
      <div className="bg-gradient-primary py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center text-primary-foreground">
            <h2 className="mb-4 text-3xl font-bold">Built for Africa</h2>
            <p className="mb-12 text-lg opacity-90">
              Send money to friends and family using just their phone number
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
              Create Your Wallet
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Get Started in 3 Steps</h2>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "1", title: "Sign Up", desc: "Create your account with your phone number" },
              { step: "2", title: "Get Your Wallet", desc: "Receive your secure wallet address instantly" },
              { step: "3", title: "Start Sending", desc: "Transfer money to contacts in seconds" },
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

      {/* CTA Section */}
      <div className="bg-muted py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Start?</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join thousands of users already using FinMo
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-gradient-primary hover:opacity-90 text-lg h-14 px-8"
          >
            Create Free Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
