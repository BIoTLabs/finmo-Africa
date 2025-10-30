import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Send, ArrowDownToLine, ShoppingCart, Store, CreditCard, Settings, Coins } from "lucide-react";
import { use2FAPreferences } from "@/hooks/use2FAPreferences";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TwoFactorPreferences = () => {
  const { preferences, loading, updatePreference } = use2FAPreferences();

  if (loading) {
    return (
      <Card className="shadow-finmo-md">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return null;
  }

  const preferenceItems = [
    {
      key: "require_on_login" as const,
      icon: Lock,
      title: "Login",
      description: "Require 2FA when signing in",
    },
    {
      key: "require_on_send" as const,
      icon: Send,
      title: "Send Money",
      description: "Require 2FA when sending funds",
    },
    {
      key: "require_on_withdraw" as const,
      icon: ArrowDownToLine,
      title: "Withdraw",
      description: "Require 2FA when withdrawing to external wallets",
    },
    {
      key: "require_on_p2p_trade" as const,
      icon: Store,
      title: "P2P Trading",
      description: "Require 2FA for P2P buy/sell orders",
    },
    {
      key: "require_on_marketplace_purchase" as const,
      icon: ShoppingCart,
      title: "Marketplace Purchases",
      description: "Require 2FA when buying from marketplace",
    },
    {
      key: "require_on_security_changes" as const,
      icon: Settings,
      title: "Security Changes",
      description: "Require 2FA when changing security settings",
    },
    {
      key: "require_on_payment_method_changes" as const,
      icon: CreditCard,
      title: "Payment Methods",
      description: "Require 2FA when adding/removing payment methods",
    },
  ];

  return (
    <Card className="shadow-finmo-md">
      <CardHeader>
        <CardTitle>2FA Preferences</CardTitle>
        <CardDescription>
          Choose which activities require two-factor authentication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-sm">
            Enable 2FA for sensitive actions to add an extra layer of security to your account.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {preferenceItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={item.key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {item.title}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={item.key}
                  checked={preferences[item.key]}
                  onCheckedChange={(checked) => updatePreference(item.key, checked)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TwoFactorPreferences;
