import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Rocket, Calendar } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import finmoLogo from "@/assets/finmo-logo.png";

const ComingSoon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine which feature based on path
  const isStaking = location.pathname.includes('staking');
  const isVirtualCard = location.pathname.includes('virtual-card');
  
  const featureName = isStaking ? "Staking" : isVirtualCard ? "Virtual Cards" : "This Feature";
  const featureDescription = isStaking 
    ? "Earn passive income on your crypto holdings with flexible and locked staking options"
    : isVirtualCard
    ? "Create instant virtual debit cards funded with crypto for online shopping"
    : "New exciting feature";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{featureName}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-finmo-md">
            <img src={finmoLogo} alt="FinMo" className="w-12 h-12" />
          </div>
          <Rocket className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Coming Soon!</h2>
          <p className="text-lg text-muted-foreground">
            {featureName} is currently under development
          </p>
        </div>

        <Card className="shadow-finmo-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              What to Expect
            </CardTitle>
            <CardDescription>
              {featureDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                We're working hard to bring you {featureName.toLowerCase()}. This feature will be available in a future update. 
                Stay tuned for announcements!
              </p>
            </div>

            {isStaking && (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Flexible & locked staking options</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Competitive APY rates</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Multiple token support</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Auto-compound rewards</span>
                </li>
              </ul>
            )}

            {isVirtualCard && (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Instant card creation</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Fund with USDC/USDT</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Global online payments</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Real-time spending controls</span>
                </li>
              </ul>
            )}

            <Button onClick={() => navigate('/dashboard')} className="w-full mt-6" size="lg">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
};

export default ComingSoon;
