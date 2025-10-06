import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const VirtualCardPoll = () => {
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingVote, setCheckingVote] = useState(true);

  useEffect(() => {
    checkExistingVote();
  }, []);

  const checkExistingVote = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("virtual_card_poll")
        .select("response")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedResponse(data.response);
        setHasVoted(true);
      }
    } catch (error) {
      console.error("Error checking vote:", error);
    } finally {
      setCheckingVote(false);
    }
  };

  const handleVote = async (response: 'yes' | 'no' | 'maybe') => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("virtual_card_poll")
        .insert({
          user_id: user.id,
          response: response
        });

      if (error) throw error;

      setSelectedResponse(response);
      setHasVoted(true);
      toast.success("Thank you for your feedback!");
    } catch (error: any) {
      console.error("Error submitting vote:", error);
      if (error.code === '23505') {
        toast.error("You have already voted");
      } else {
        toast.error("Failed to submit vote");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingVote) {
    return null;
  }

  if (hasVoted) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Thanks for voting!</p>
            <p className="text-xs text-muted-foreground">
              Your response: <span className="capitalize font-semibold">{selectedResponse}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Help Us Improve!</CardTitle>
        <CardDescription className="text-sm">
          Will you be willing to pay $5 to get a virtual card for your account?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVote('yes')}
            disabled={loading}
            className="bg-success/10 hover:bg-success/20 border-success/30"
          >
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVote('maybe')}
            disabled={loading}
            className="bg-warning/10 hover:bg-warning/20 border-warning/30"
          >
            Maybe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVote('no')}
            disabled={loading}
            className="bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
          >
            No
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VirtualCardPoll;
