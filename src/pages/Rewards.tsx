import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Gift, TrendingUp, Award, ArrowRight, Zap, Users, ShoppingBag, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeRewards } from "@/hooks/useRealtimeRewards";
import MobileNav from "@/components/MobileNav";

interface UserRewards {
  total_points: number;
  early_bird_points: number;
  activity_points: number;
  current_level: number;
}

interface UserBadge {
  badge_type: string;
  badge_name: string;
  badge_description: string;
  awarded_at: string;
}

interface ActivitySummary {
  category: string;
  icon: any;
  color: string;
  points: number;
  count: number;
}

const Rewards = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary[]>([]);
  const { rewards, loading: rewardsLoading } = useRealtimeRewards(userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      // Check if user has rewards entry
      const { data: existingRewards } = await supabase
        .from("user_rewards")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // If no rewards exist, initialize with account creation reward
      if (!existingRewards) {
        // Award account creation points
        await supabase.rpc('award_points', {
          _user_id: user.id,
          _activity_type: 'account_creation',
          _metadata: {}
        });

        // Check if user has synced contacts and award points
        const { count: contactCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (contactCount && contactCount > 0) {
          await supabase.rpc('award_points', {
            _user_id: user.id,
            _activity_type: 'contact_sync',
            _metadata: { contact_count: contactCount }
          });
        }
      }

      // Load badges
      const { data: badgesData, error: badgesError } = await supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false });

      if (badgesError) throw badgesError;
      setBadges(badgesData || []);

      // Load activity summary
      const { data: activitiesData } = await supabase
        .from("reward_activities")
        .select("activity_type, points_awarded")
        .eq("user_id", user.id);

      if (activitiesData) {
        // Group activities by category
        const summary: Record<string, { points: number; count: number }> = {};
        
        activitiesData.forEach((activity) => {
          const type = activity.activity_type;
          if (!summary[type]) {
            summary[type] = { points: 0, count: 0 };
          }
          summary[type].points += activity.points_awarded;
          summary[type].count += 1;
        });

        // Convert to array with metadata
        const summaryArray: ActivitySummary[] = Object.entries(summary).map(([type, data]) => {
          let category = "Other";
          let icon = Award;
          let color = "text-primary";

          if (["account_creation", "kyc_completion"].includes(type)) {
            category = "Account Setup";
            icon = CheckCircle;
            color = "text-green-500";
          } else if (["contact_sync", "user_invitation"].includes(type)) {
            category = "Network Building";
            icon = Users;
            color = "text-blue-500";
          } else if (["first_transaction", "transaction_volume", "transaction_frequency"].includes(type)) {
            category = "Transactions";
            icon = TrendingUp;
            color = "text-emerald-500";
          } else if (["p2p_trade", "marketplace_purchase"].includes(type)) {
            category = "Marketplace";
            icon = ShoppingBag;
            color = "text-purple-500";
          } else if (type === "monthly_retention") {
            category = "Retention";
            icon = Clock;
            color = "text-orange-500";
          }

          return {
            category,
            icon,
            color,
            points: data.points,
            count: data.count
          };
        });

        // Merge categories with same name
        const mergedSummary: Record<string, ActivitySummary> = {};
        summaryArray.forEach((item) => {
          if (!mergedSummary[item.category]) {
            mergedSummary[item.category] = item;
          } else {
            mergedSummary[item.category].points += item.points;
            mergedSummary[item.category].count += item.count;
          }
        });

        setActivitySummary(Object.values(mergedSummary).sort((a, b) => b.points - a.points));
      }
    } catch (error: any) {
      console.error("Error loading rewards:", error);
      toast.error("Failed to load rewards data");
    } finally {
      setLoading(false);
    }
  };

  const getBadgeIcon = (badgeType: string) => {
    switch (badgeType) {
      case "finmo_pioneer":
        return "🏆";
      case "volume_trader":
        return "💎";
      case "steady_earner":
        return "⭐";
      case "kyc_verified":
        return "✅";
      case "super_connector":
        return "🤝";
      default:
        return "🎖️";
    }
  };

  if (loading || rewardsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading rewards...</p>
        </div>
      </div>
    );
  }

  const nextLevelPoints = (rewards?.current_level || 1) * 1000;
  const progressPercentage = ((rewards?.total_points || 0) / nextLevelPoints) * 100;

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileNav />
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background px-4 pt-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">FinMo Rewards</h1>
          </div>
          <p className="text-lg text-muted-foreground mb-6">
            Earn While You Engage
          </p>
          <p className="text-sm text-muted-foreground">
            Join FinMo early and earn points for every activity — from wallet creation to active trading. 
            Your points unlock exclusive badges, milestones, and upcoming token airdrops. 
            The more you use FinMo, the more you earn.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Points Summary Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Total Points</CardTitle>
                <CardDescription>Level {rewards?.current_level || 1} Achiever</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">
                  {rewards?.total_points.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress to Level {(rewards?.current_level || 1) + 1}</span>
                <span className="text-muted-foreground">
                  {rewards?.total_points.toLocaleString()} / {nextLevelPoints.toLocaleString()}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Early Bird</p>
                </div>
                <p className="text-xl font-semibold">{rewards?.early_bird_points.toLocaleString() || 0}</p>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Activity</p>
                </div>
                <p className="text-xl font-semibold">{rewards?.activity_points.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Points by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Points by Category</CardTitle>
            <CardDescription>Breakdown of your earnings by activity type</CardDescription>
          </CardHeader>
          <CardContent>
            {activitySummary.length > 0 ? (
              <div className="space-y-3">
                {activitySummary.map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-accent/50 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className={`h-5 w-5 ${item.color}`} />
                        <div>
                          <p className="font-medium text-sm">{item.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.count} {item.count === 1 ? 'activity' : 'activities'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">+{item.points}</p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Start engaging to see your points breakdown!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Badges Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle>Your Badges</CardTitle>
              </div>
              <Badge variant="secondary">{badges.length} earned</Badge>
            </div>
            <CardDescription>Non-transferable NFTs celebrating your milestones</CardDescription>
          </CardHeader>
          <CardContent>
            {badges.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.badge_type}
                    className="bg-accent/50 rounded-lg p-4 text-center border border-primary/20"
                  >
                    <div className="text-4xl mb-2">{getBadgeIcon(badge.badge_type)}</div>
                    <p className="font-semibold text-sm">{badge.badge_name}</p>
                    {badge.badge_description && (
                      <p className="text-xs text-muted-foreground mt-1">{badge.badge_description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Complete activities to earn your first badge!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle>How It Works</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Earn Points</p>
                  <p className="text-sm text-muted-foreground">
                    For sign-up, verification, transactions, and consistent engagement
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Award className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Collect Badges</p>
                  <p className="text-sm text-muted-foreground">
                    Non-transferable NFTs celebrating your FinMo milestones
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Future Benefits</p>
                  <p className="text-sm text-muted-foreground">
                    Accumulated points contribute to token airdrops and loyalty tiers
                  </p>
                </div>
              </div>
            </div>

            <Button 
              className="w-full mt-4" 
              onClick={() => navigate("/rewards/details")}
            >
              View Detailed Breakdown
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your activity today defines your rewards tomorrow — stay active, earn more, and grow with FinMo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Rewards;
