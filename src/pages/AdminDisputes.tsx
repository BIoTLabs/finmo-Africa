import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";

interface Dispute {
  id: string;
  user_id: string;
  dispute_type: string;
  order_id: string;
  reason: string;
  description: string;
  status: string;
  admin_notes: string;
  created_at: string;
}

const AdminDisputes = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      toast.error('Access denied');
    } else if (isAdmin) {
      fetchDisputes();
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchDisputes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching disputes:", error);
      toast.error("Failed to load disputes");
    } else {
      setDisputes(data || []);
    }
    setLoading(false);
  };

  const handleUpdateDispute = async () => {
    if (!selectedDispute) return;

    const { error } = await supabase
      .from("disputes")
      .update({
        status: newStatus || selectedDispute.status,
        admin_notes: adminNotes,
        resolved_at: ['resolved', 'rejected'].includes(newStatus) ? new Date().toISOString() : null,
      })
      .eq("id", selectedDispute.id);

    if (error) {
      console.error("Error updating dispute:", error);
      toast.error("Failed to update dispute");
    } else {
      toast.success("Dispute updated successfully");
      setSelectedDispute(null);
      setAdminNotes("");
      setNewStatus("");
      fetchDisputes();
    }
  };

  if (adminLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Dispute Management</h1>
            <p className="text-sm text-muted-foreground">{disputes.length} total disputes</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-4">
        {disputes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No disputes to review</p>
            </CardContent>
          </Card>
        ) : (
          disputes.map((dispute) => (
            <Card key={dispute.id} className="hover:shadow-finmo-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {dispute.dispute_type === 'p2p_order' ? 'P2P Order' : 'Marketplace'} Dispute
                  </CardTitle>
                  <Badge variant={
                    dispute.status === 'pending' ? 'outline' :
                    dispute.status === 'resolved' ? 'default' :
                    dispute.status === 'investigating' ? 'secondary' : 'destructive'
                  }>
                    {dispute.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold mb-1">Reason:</p>
                  <p className="text-sm">{dispute.reason}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Description:</p>
                  <p className="text-sm text-muted-foreground">{dispute.description}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Order ID: {dispute.order_id.slice(0, 8)}... | 
                    Created: {new Date(dispute.created_at).toLocaleDateString()}
                  </p>
                </div>
                
                {selectedDispute?.id === dispute.id ? (
                  <div className="space-y-3 mt-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-semibold">Update Status</label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="investigating">Investigating</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Admin Notes</label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add resolution notes..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateDispute} size="sm">
                        Save Changes
                      </Button>
                      <Button onClick={() => setSelectedDispute(null)} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setAdminNotes(dispute.admin_notes || "");
                      setNewStatus(dispute.status);
                    }} 
                    variant="outline" 
                    size="sm"
                    className="w-full mt-2"
                  >
                    Review Dispute
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminDisputes;
