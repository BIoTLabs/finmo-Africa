import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface TokenSelectorProps {
  chainId: number;
  value: string;
  onChange: (token: string) => void;
  label?: string;
  className?: string;
}

interface ChainToken {
  token_symbol: string;
  contract_address: string;
  decimals: number;
}

export const TokenSelector = ({ chainId, value, onChange, label = "Token", className }: TokenSelectorProps) => {
  const [tokens, setTokens] = useState<ChainToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('chain_tokens')
        .select('token_symbol, contract_address, decimals')
        .eq('chain_id', chainId)
        .eq('is_active', true);

      if (!error && data) {
        setTokens(data);
        // If current value is not available in this chain, select first token
        if (data.length > 0 && !data.find(t => t.token_symbol === value)) {
          onChange(data[0].token_symbol);
        }
      }
      setLoading(false);
    };

    if (chainId) {
      fetchTokens();
    }
  }, [chainId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading tokens...</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tokens.map((token) => (
            <SelectItem key={token.token_symbol} value={token.token_symbol}>
              {token.token_symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
