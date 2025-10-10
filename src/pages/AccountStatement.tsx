import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";

export default function AccountStatement() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  const generateStatement = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all transactions
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      // Fetch marketplace orders
      const { data: marketplaceOrders } = await supabase
        .from("marketplace_orders")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      // Fetch P2P orders
      const { data: p2pOrders } = await supabase
        .from("p2p_orders")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      // Fetch current balances
      const { data: balances } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("user_id", user.id);

      // Generate CSV
      let csv = "Date,Type,Description,Amount,Currency,Status,Transaction ID\n";

      transactions?.forEach(tx => {
        const isDebit = tx.sender_id === user.id;
        const amount = isDebit ? `-${tx.amount}` : `+${tx.amount}`;
        csv += `${format(new Date(tx.created_at), "yyyy-MM-dd HH:mm:ss")},${tx.transaction_type},${tx.transaction_type},${amount},${tx.token},${tx.status},${tx.id}\n`;
      });

      marketplaceOrders?.forEach(order => {
        const isDebit = order.buyer_id === user.id;
        const amount = isDebit ? `-${order.amount}` : `+${order.amount}`;
        csv += `${format(new Date(order.created_at), "yyyy-MM-dd HH:mm:ss")},Marketplace,Order #${order.id.slice(0, 8)},${amount},${order.currency},${order.status},${order.id}\n`;
      });

      p2pOrders?.forEach(order => {
        const isDebit = order.buyer_id === user.id;
        const amount = isDebit ? `-${order.crypto_amount}` : `+${order.crypto_amount}`;
        csv += `${format(new Date(order.created_at), "yyyy-MM-dd HH:mm:ss")},P2P,${order.status} order,${amount},${order.token},${order.status},${order.id}\n`;
      });

      // Add current balances
      csv += "\n\nCurrent Balances\n";
      csv += "Token,Balance\n";
      balances?.forEach(balance => {
        csv += `${balance.token},${balance.balance}\n`;
      });

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finmo-statement-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Statement Generated",
        description: "Your account statement has been downloaded.",
      });
    } catch (error: any) {
      console.error("Error generating statement:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Account Statement
          </CardTitle>
          <CardDescription>
            Download your transaction history for tax and audit purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <Button
            onClick={generateStatement}
            disabled={loading}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {loading ? "Generating..." : "Download Statement (CSV)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
