import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTransactionLimits, getTierDisplayName, getTierBadgeColor } from "@/hooks/useTransactionLimits";

interface TransactionLimitsCardProps {
  userId: string | null;
}

export function TransactionLimitsCard({ userId }: TransactionLimitsCardProps) {
  const navigate = useNavigate();
  const limits = useTransactionLimits(userId);

  if (limits.loading) {
    return (
      <Card className="shadow-finmo-sm animate-pulse">
        <CardContent className="p-4">
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const dailyPercentage = limits.dailyLimit > 0 
    ? Math.min(100, (limits.dailyUsed / limits.dailyLimit) * 100) 
    : 0;
  const monthlyPercentage = limits.monthlyLimit > 0 
    ? Math.min(100, (limits.monthlyUsed / limits.monthlyLimit) * 100) 
    : 0;

  const canUpgrade = limits.currentTier !== 'tier_3';

  return (
    <Card className="shadow-finmo-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Transaction Limits
          </CardTitle>
          <Badge className={getTierBadgeColor(limits.currentTier)}>
            {getTierDisplayName(limits.currentTier)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily</span>
            <span className="font-medium">
              ${limits.dailyUsed.toFixed(0)} / ${limits.dailyLimit.toFixed(0)}
            </span>
          </div>
          <Progress value={dailyPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            ${limits.dailyRemaining.toFixed(0)} remaining today
          </p>
        </div>

        {/* Monthly Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly</span>
            <span className="font-medium">
              ${limits.monthlyUsed.toFixed(0)} / ${limits.monthlyLimit.toFixed(0)}
            </span>
          </div>
          <Progress value={monthlyPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            ${limits.monthlyRemaining.toFixed(0)} remaining this month
          </p>
        </div>

        {/* Single Transaction Limit */}
        <div className="flex justify-between text-sm pt-2 border-t">
          <span className="text-muted-foreground">Max per transaction</span>
          <span className="font-medium">${limits.singleTransactionLimit.toFixed(0)}</span>
        </div>

        {/* Upgrade Button */}
        {canUpgrade && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={() => navigate('/kyc-verification')}
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Upgrade Limits
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
