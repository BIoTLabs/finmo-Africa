import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminRewardsBackfill = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runBackfill = async () => {
    setLoading(true);
    setResults(null);

    try {
      toast.info("Starting rewards backfill process...");

      const { data, error } = await supabase.functions.invoke('backfill-user-rewards', {
        body: {}
      });

      if (error) throw error;

      setResults(data);
      toast.success(`Backfill complete! Processed ${data.results.length} users.`);
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast.error("Failed to run backfill", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            ← Back to Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rewards System Backfill</CardTitle>
            <CardDescription>
              This tool will retroactively calculate and award points and badges for all existing users
              based on their historical activities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold">What this backfill does:</p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Awards account creation points (100 pts)</li>
                <li>Awards KYC completion points if verified</li>
                <li>Awards contact sync points if contacts exist</li>
                <li>Awards first transaction points</li>
                <li>Calculates and awards transaction volume points</li>
                <li>Calculates and awards transaction frequency points</li>
                <li>Awards appropriate badges based on achievements</li>
              </ul>
            </div>

            <Button
              onClick={runBackfill}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Run Backfill
                </>
              )}
            </Button>

            {results && (
              <Card className="bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">Backfill Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{results.results.length}</p>
                      <p className="text-xs text-muted-foreground">Total Processed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">
                        {results.results.filter((r: any) => r.success).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </div>
                  </div>

                  {results.results && results.results.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold mb-2">Details:</p>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {results.results.map((result: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-background rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {result.success ? (
                                <CheckCircle className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="font-mono text-xs">
                                {result.user_id.substring(0, 8)}...
                              </span>
                            </div>
                            {result.success ? (
                              <span className="text-xs text-muted-foreground">
                                {result.contact_count} contacts
                              </span>
                            ) : (
                              <span className="text-xs text-destructive">
                                {result.error}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRewardsBackfill;
