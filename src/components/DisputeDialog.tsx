import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DisputeDialogProps {
  orderId: string;
  orderType: 'p2p_order' | 'marketplace_order';
  trigger?: React.ReactNode;
}

const DisputeDialog = ({ orderId, orderType, trigger }: DisputeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("disputes").insert({
        user_id: user.id,
        dispute_type: orderType,
        order_id: orderId,
        reason,
        description,
        status: 'pending'
      });

      if (error) throw error;

      toast.success("Dispute submitted successfully. An admin will review it shortly.");
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (error: any) {
      console.error("Error submitting dispute:", error);
      toast.error("Failed to submit dispute. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Describe the problem with this order. Our team will review and help resolve it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="reason">Issue Type</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_not_received">Payment Not Received</SelectItem>
                <SelectItem value="product_not_as_described">Product Not As Described</SelectItem>
                <SelectItem value="product_not_delivered">Product Not Delivered</SelectItem>
                <SelectItem value="scam_attempt">Scam Attempt</SelectItem>
                <SelectItem value="other_party_unresponsive">Other Party Unresponsive</SelectItem>
                <SelectItem value="other">Other Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information about the issue..."
              rows={5}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !reason || !description.trim()}
            className="w-full"
          >
            {submitting ? "Submitting..." : "Submit Dispute"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DisputeDialog;
