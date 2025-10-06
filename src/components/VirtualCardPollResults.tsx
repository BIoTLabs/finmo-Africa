import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react";

interface PollResult {
  response: string;
  count: number;
}

const VirtualCardPollResults = () => {
  const [results, setResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from("virtual_card_poll")
        .select("response");

      if (error) throw error;

      // Count responses
      const counts = { yes: 0, no: 0, maybe: 0 };
      data?.forEach(item => {
        if (item.response in counts) {
          counts[item.response as keyof typeof counts]++;
        }
      });

      setResults([
        { response: 'yes', count: counts.yes },
        { response: 'maybe', count: counts.maybe },
        { response: 'no', count: counts.no },
      ]);
    } catch (error) {
      console.error("Error fetching poll results:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

  const getIcon = (response: string) => {
    switch (response) {
      case 'yes': return <ThumbsUp className="w-5 h-5 text-success" />;
      case 'no': return <ThumbsDown className="w-5 h-5 text-destructive" />;
      case 'maybe': return <HelpCircle className="w-5 h-5 text-warning" />;
      default: return null;
    }
  };

  const getColor = (response: string) => {
    switch (response) {
      case 'yes': return 'text-success';
      case 'no': return 'text-destructive';
      case 'maybe': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return <div>Loading poll results...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Virtual Card Poll Results
        </CardTitle>
        <CardDescription>
          Will you be willing to pay $5 to get a virtual card for your account?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-6">
          <p className="text-3xl font-bold">{totalVotes}</p>
          <p className="text-sm text-muted-foreground">Total Votes</p>
        </div>

        {results.map((result) => {
          const percentage = totalVotes > 0 ? (result.count / totalVotes) * 100 : 0;
          
          return (
            <div key={result.response} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(result.response)}
                  <span className="capitalize font-semibold">{result.response}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {result.count} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-secondary/20 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    result.response === 'yes' ? 'bg-success' : 
                    result.response === 'no' ? 'bg-destructive' : 
                    'bg-warning'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default VirtualCardPollResults;
