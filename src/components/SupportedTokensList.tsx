import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTokenInfo, groupTokensByCategory } from "@/utils/tokenInfo";
import { Coins } from "lucide-react";

interface TokenData {
  token_symbol: string;
  chain_count: number;
}

export const SupportedTokensList = () => {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      const { data, error } = await supabase
        .from('chain_tokens')
        .select('token_symbol, chain_id')
        .eq('is_active', true);

      if (!error && data) {
        // Group by token and count chains
        const tokenMap = data.reduce((acc, item) => {
          if (!acc[item.token_symbol]) {
            acc[item.token_symbol] = { token_symbol: item.token_symbol, chain_count: 0 };
          }
          acc[item.token_symbol].chain_count++;
          return acc;
        }, {} as Record<string, TokenData>);

        setTokens(Object.values(tokenMap));
      }
      setLoading(false);
    };

    fetchTokens();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading tokens...
        </CardContent>
      </Card>
    );
  }

  const categorizedTokens = groupTokensByCategory(
    tokens.map(t => ({ token: t.token_symbol, balance: 0 }))
  );

  return (
    <Card className="shadow-finmo-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Coins className="w-4 h-4" />
          Supported Tokens ({tokens.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(categorizedTokens).map(([category, categoryTokens]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {category}
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryTokens.map((tokenData) => {
                const tokenInfo = getTokenInfo(tokenData.token);
                const fullToken = tokens.find(t => t.token_symbol === tokenData.token);
                return (
                  <Badge
                    key={tokenData.token}
                    variant="secondary"
                    className="text-sm py-1.5 px-3"
                  >
                    <span className="mr-1.5">{tokenInfo.icon}</span>
                    <span className="font-semibold">{tokenData.token}</span>
                    <span className="ml-1.5 text-xs opacity-70">
                      ({fullToken?.chain_count || 0} chains)
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            All tokens available across multiple blockchain networks. Your wallet address works for all tokens on all supported chains.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
