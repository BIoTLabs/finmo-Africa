import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, X } from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";

interface Badge {
  badge_type: string;
  badge_name: string;
  badge_description: string;
  awarded_at: string;
}

export const RewardsNotification = ({ userId }: { userId: string | null }) => {
  const navigate = useNavigate();
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupBadgeListener = () => {
      channel = supabase
        .channel('badge-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_badges',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const badge = payload.new as Badge;
            const awardedAt = new Date(badge.awarded_at);
            
            // Only show if awarded after component mounted
            if (awardedAt > lastChecked) {
              setNewBadge(badge);
              setTimeout(() => setNewBadge(null), 10000); // Auto-hide after 10s
            }
          }
        )
        .subscribe();
    };

    setupBadgeListener();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, lastChecked]);

  if (!newBadge) return null;

  const getBadgeEmoji = (badgeType: string) => {
    switch (badgeType) {
      case "finmo_pioneer": return "🏆";
      case "volume_trader": return "💎";
      case "steady_earner": return "⭐";
      case "kyc_verified": return "✅";
      case "super_connector": return "🤝";
      default: return "🎖️";
    }
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4 animate-slide-down">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-4xl">{getBadgeEmoji(newBadge.badge_type)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">New Badge Unlocked!</p>
              </div>
              <p className="text-sm font-medium">{newBadge.badge_name}</p>
              <p className="text-xs text-muted-foreground">{newBadge.badge_description}</p>
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 mt-2"
                onClick={() => {
                  setNewBadge(null);
                  navigate('/rewards');
                }}
              >
                View Rewards →
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setNewBadge(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
