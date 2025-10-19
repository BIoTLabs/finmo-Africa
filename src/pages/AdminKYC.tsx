import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KYCVerification {
  id: string;
  user_id: string;
  full_name: string;
  country_code: string;
  date_of_birth: string;
  address: string;
  id_type: string;
  id_number: string;
  id_document_url: string | null;
  selfie_url: string | null;
  status: string;
  submitted_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
  profiles: {
    phone_number: string;
    email: string;
  } | null;
}

const AdminKYC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKYC, setSelectedKYC] = useState<KYCVerification | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchKYCVerifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data separately
      const kycWithProfiles = await Promise.all(
        (data || []).map(async (kyc) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number, email')
            .eq('id', kyc.user_id)
            .single();
          
          return {
            ...kyc,
            profiles: profile,
          };
        })
      );

      setVerifications(kycWithProfiles);
    } catch (error: any) {
      console.error('Error fetching KYC verifications:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch KYC verifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (kycId: string) => {
    try {
      const { error } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'approved',
          verified_at: new Date().toISOString(),
        })
        .eq('id', kycId);

      if (error) throw error;

      // Award KYC completion points
      const verification = verifications.find(v => v.id === kycId);
      if (verification) {
        await supabase.functions.invoke('award-activity-points', {
          body: {
            user_id: verification.user_id,
            activity_type: 'kyc_completion',
          },
        });
      }

      toast({
        title: 'Success',
        description: 'KYC verification approved successfully',
      });

      fetchKYCVerifications();
    } catch (error: any) {
      console.error('Error approving KYC:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve KYC verification',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (kycId: string, reason: string = 'Documents do not meet requirements') => {
    try {
      const { error } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', kycId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'KYC verification rejected',
      });

      fetchKYCVerifications();
    } catch (error: any) {
      console.error('Error rejecting KYC:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject KYC verification',
        variant: 'destructive',
      });
    }
  };

  const viewDetails = (kyc: KYCVerification) => {
    setSelectedKYC(kyc);
    setViewDialogOpen(true);
  };

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges',
        variant: 'destructive',
      });
    }
  }, [isAdmin, adminLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchKYCVerifications();
    }
  }, [isAdmin]);

  if (adminLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">KYC Verifications</h1>
              <p className="text-muted-foreground">Manage user identity verifications</p>
            </div>
          </div>
          <Button onClick={fetchKYCVerifications} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>KYC Submissions</CardTitle>
            <CardDescription>
              Review and approve or reject user identity verifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No KYC verifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  verifications.map((kyc) => (
                    <TableRow key={kyc.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{kyc.profiles?.phone_number || 'N/A'}</div>
                          <div className="text-muted-foreground">{kyc.profiles?.email || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{kyc.full_name}</TableCell>
                      <TableCell>{kyc.country_code}</TableCell>
                      <TableCell>{kyc.id_type}</TableCell>
                      <TableCell>{new Date(kyc.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(kyc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {kyc.status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(kyc.id)}
                                className="bg-success hover:bg-success/90"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleReject(kyc.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>KYC Details</DialogTitle>
              <DialogDescription>
                Review the submitted identity verification details
              </DialogDescription>
            </DialogHeader>
            {selectedKYC && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-sm">Full Name</h3>
                    <p className="text-sm">{selectedKYC.full_name}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Date of Birth</h3>
                    <p className="text-sm">{new Date(selectedKYC.date_of_birth).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Country</h3>
                    <p className="text-sm">{selectedKYC.country_code}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">ID Type</h3>
                    <p className="text-sm">{selectedKYC.id_type}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">ID Number</h3>
                    <p className="text-sm">{selectedKYC.id_number}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Status</h3>
                    {getStatusBadge(selectedKYC.status)}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Address</h3>
                  <p className="text-sm">{selectedKYC.address}</p>
                </div>
                {selectedKYC.rejection_reason && (
                  <div>
                    <h3 className="font-semibold text-sm">Rejection Reason</h3>
                    <p className="text-sm text-destructive">{selectedKYC.rejection_reason}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {selectedKYC.id_document_url && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2">ID Document</h3>
                      <img
                        src={selectedKYC.id_document_url}
                        alt="ID Document"
                        className="w-full rounded-lg border"
                      />
                    </div>
                  )}
                  {selectedKYC.selfie_url && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Selfie</h3>
                      <img
                        src={selectedKYC.selfie_url}
                        alt="Selfie"
                        className="w-full rounded-lg border"
                      />
                    </div>
                  )}
                </div>
                {selectedKYC.status === 'pending' && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        handleApprove(selectedKYC.id);
                        setViewDialogOpen(false);
                      }}
                      className="flex-1 bg-success hover:bg-success/90"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleReject(selectedKYC.id);
                        setViewDialogOpen(false);
                      }}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminKYC;
