import { ArrowUpRight, ArrowDownLeft, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExplorerTransaction } from "@/hooks/useRealtimeExplorer";

interface ExplorerTransactionCardProps {
  transaction: ExplorerTransaction;
}

export const ExplorerTransactionCard = ({ transaction }: ExplorerTransactionCardProps) => {
  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pending':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'deposit' || type === 'receive' ? 
      <ArrowDownLeft className="h-4 w-4 text-green-500" /> : 
      <ArrowUpRight className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1">
            {getTypeIcon(transaction.transaction_type)}
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                {transaction.transaction_type}
              </Badge>
              <Badge className={getStatusColor(transaction.status)}>
                {transaction.status}
              </Badge>
              {transaction.chain_name && (
                <Badge variant="secondary">{transaction.chain_name}</Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">From:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {formatAddress(transaction.sender_wallet)}
                </code>
                <button
                  onClick={() => copyAddress(transaction.sender_wallet)}
                  className="hover:text-primary"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">To:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {formatAddress(transaction.recipient_wallet)}
                </code>
                <button
                  onClick={() => copyAddress(transaction.recipient_wallet)}
                  className="hover:text-primary"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>

              {transaction.transaction_hash && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Hash:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {formatAddress(transaction.transaction_hash)}
                  </code>
                  <button
                    onClick={() => copyAddress(transaction.transaction_hash!)}
                    className="hover:text-primary"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <a
                    href={`https://amoy.polygonscan.com/tx/${transaction.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold">
            {transaction.amount} {transaction.token}
          </div>
        </div>
      </div>
    </div>
  );
};
