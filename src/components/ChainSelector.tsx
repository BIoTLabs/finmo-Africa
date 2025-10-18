import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SUPPORTED_CHAINS } from "@/utils/blockchain";

interface ChainSelectorProps {
  value: number;
  onChange: (chainId: number) => void;
  label?: string;
  className?: string;
}

export const ChainSelector = ({ value, onChange, label = "Network", className }: ChainSelectorProps) => {
  const chains = Object.values(SUPPORTED_CHAINS);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {chains.map((chain) => (
            <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{chain.name}</span>
                <span className="text-xs text-muted-foreground">({chain.nativeCurrency.symbol})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
