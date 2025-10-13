import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, TrendingUp, Users, ShoppingBag, Award } from "lucide-react";
import { toast } from "sonner";

interface RewardActivity {
  id: string;
  activity_type: string;
  points_awarded: number;
  created_at: string;
  metadata: any;
}

interface RewardRule {
  activity_type: string;
  points_base: number;
  max_points_per_period: number | null;
  metadata: any;
}

const RewardsDetails = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<RewardActivity[]>([]);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("reward_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activitiesError) throw activitiesError;
      setActivities(activitiesData || []);

      // Load rules
      const { data: rulesData, error: rulesError } = await supabase
        .from("reward_rules")
        .select("*")
        .eq("is_active", true)
        .order("points_base", { ascending: false });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load rewards details");
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case "account_creation":
      case "kyc_completion":
        return <Award className="h-5 w-5 text-primary" />;
      case "contact_sync":
      case "user_invitation":
        return <Users className="h-5 w-5 text-blue-500" />;
      case "first_transaction":
      case "transaction_volume":
      case "transaction_frequency":
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "p2p_trade":
      case "marketplace_purchase":
        return <ShoppingBag className="h-5 w-5 text-purple-500" />;
      case "monthly_retention":
        return <Clock className="h-5 w-5 text-orange-500" />;
      default:
        return <Award className="h-5 w-5 text-primary" />;
    }
  };

  const formatActivityType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rewards")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Rewards Breakdown</h1>
            <p className="text-sm text-muted-foreground">Track your earning activities</p>
          </div>
        </div>

        {/* Ways to Earn */}
        <Card>
          <CardHeader>
            <CardTitle>Ways to Earn Points</CardTitle>
            <CardDescription>Complete these activities to maximize your rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.activity_type}
                  className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getActivityIcon(rule.activity_type)}
                    <div>
                      <p className="font-medium text-sm">{formatActivityType(rule.activity_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.metadata?.description || "Earn points for this activity"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">+{rule.points_base}</p>
                    {rule.max_points_per_period && (
                      <p className="text-xs text-muted-foreground">
                        Max: {rule.max_points_per_period}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest point-earning actions</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getActivityIcon(activity.activity_type)}
                      <div>
                        <p className="font-medium text-sm">
                          {formatActivityType(activity.activity_type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-semibold">
                      +{activity.points_awarded} pts
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No activity yet. Start earning points!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">About the Rewards Program</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The FinMo Rewards Program tracks your activity across transactions, referrals, and
              retention to reward meaningful participation. Accumulated points contribute to token
              airdrops and loyalty tiers in the future.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Early Bird Points: Limited-time bonuses for early adopters</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Activity Points: Ongoing rewards for platform engagement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Badge NFTs: Non-transferable achievements you can showcase</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RewardsDetails;
