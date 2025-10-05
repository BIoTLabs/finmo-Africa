import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Save } from "lucide-react";

interface WithdrawalFees {
  USDC: number;
  MATIC: number;
}

export const AdminFeeSettings = () => {
  const [fees, setFees] = useState<WithdrawalFees>({ USDC: 0.50, MATIC: 0.02 });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'withdrawal_fees')
        .single();

      if (error) throw error;

      if (data?.setting_value && typeof data.setting_value === 'object') {
        setFees(data.setting_value as unknown as WithdrawalFees);
      }
    } catch (error: any) {
      console.error('Error fetching fees:', error);
      toast.error('Failed to load withdrawal fees');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleUpdateFees = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('admin_settings')
        .update({
          setting_value: fees as unknown as any,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'withdrawal_fees');

      if (error) throw error;

      toast.success('Withdrawal fees updated successfully');
    } catch (error: any) {
      console.error('Error updating fees:', error);
      toast.error(error.message || 'Failed to update fees');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Withdrawal Fee Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Withdrawal Fee Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure withdrawal fees for external blockchain transfers. Internal FinMo transfers are always free.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usdc-fee">USDC Withdrawal Fee</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="usdc-fee"
                type="number"
                step="0.01"
                min="0"
                value={fees.USDC}
                onChange={(e) => setFees({ ...fees, USDC: parseFloat(e.target.value) || 0 })}
                className="flex-1"
              />
              <span className="text-muted-foreground">USDC</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matic-fee">MATIC Withdrawal Fee</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="matic-fee"
                type="number"
                step="0.01"
                min="0"
                value={fees.MATIC}
                onChange={(e) => setFees({ ...fees, MATIC: parseFloat(e.target.value) || 0 })}
                className="flex-1"
              />
              <span className="text-muted-foreground">MATIC</span>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleUpdateFees} 
          disabled={loading}
          className="w-full"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : 'Save Fee Settings'}
        </Button>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-semibold">Current Fee Structure:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Internal transfers: <strong className="text-success">Free</strong></li>
            <li>• USDC withdrawals: <strong>{fees.USDC} USDC</strong></li>
            <li>• MATIC withdrawals: <strong>{fees.MATIC} MATIC</strong></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
