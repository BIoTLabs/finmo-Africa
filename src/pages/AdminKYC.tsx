import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, CheckCircle, XCircle, Eye, RefreshCw, Search, 
  Download, AlertTriangle, User, FileText, Camera, MapPin,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Shield, Clock,
  ChevronDown, ChevronUp, Filter, Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';
import { getTierDisplayName, getTierColor } from '@/hooks/useKYCTiers';

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
  proof_of_address_url: string | null;
  status: string;
  kyc_tier: string;
  verification_level: string;
  submitted_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
  risk_score: number;
  risk_flags: any[];
  admin_notes: string | null;
  reviewer_checklist: Record<string, boolean>;
  tax_id: string | null;
  tax_id_type: string | null;
  source_of_funds: string | null;
  occupation: string | null;
  profiles: {
    phone_number: string;
    email: string;
    kyc_tier: string;
  } | null;
}

interface KYCStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  avgReviewTime: number;
  byCountry: Record<string, number>;
}

const REJECTION_REASONS = [
  'Document is unclear or unreadable',
  'ID document appears to be expired',
  'Face does not match ID photo',
  'Name mismatch between ID and application',
  'Suspected fraudulent document',
  'Incomplete information provided',
  'Address proof does not match stated address',
  'Document type not accepted for this country',
  'Other (specify in notes)',
];

const VERIFICATION_CHECKLIST = [
  { key: 'document_clear', label: 'Document is clear and readable' },
  { key: 'document_valid', label: 'Document is valid (not expired)' },
  { key: 'face_match', label: 'Face matches ID photo' },
  { key: 'name_match', label: 'Name matches on all documents' },
  { key: 'dob_match', label: 'Date of birth is consistent' },
  { key: 'address_verified', label: 'Address has been verified' },
  { key: 'no_fraud_indicators', label: 'No fraud indicators detected' },
];

const AdminKYC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKYC, setSelectedKYC] = useState<KYCVerification | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState('');
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [approvalTier, setApprovalTier] = useState<string>('tier_1');
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [stats, setStats] = useState<KYCStats | null>(null);
  const { toast } = useToast();

  const fetchKYCVerifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const kycWithProfiles = await Promise.all(
        (data || []).map(async (kyc) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number, email, kyc_tier')
            .eq('id', kyc.user_id)
            .single();
          
          return {
            ...kyc,
            profiles: profile,
            reviewer_checklist: typeof kyc.reviewer_checklist === 'string' 
              ? JSON.parse(kyc.reviewer_checklist) 
              : kyc.reviewer_checklist || {},
            risk_flags: typeof kyc.risk_flags === 'string'
              ? JSON.parse(kyc.risk_flags)
              : kyc.risk_flags || [],
          };
        })
      );

      setVerifications(kycWithProfiles);
      calculateStats(kycWithProfiles);
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

  const calculateStats = (data: KYCVerification[]) => {
    const byCountry: Record<string, number> = {};
    let totalReviewTime = 0;
    let reviewedCount = 0;

    data.forEach(kyc => {
      byCountry[kyc.country_code] = (byCountry[kyc.country_code] || 0) + 1;
      if (kyc.verified_at && kyc.submitted_at) {
        totalReviewTime += new Date(kyc.verified_at).getTime() - new Date(kyc.submitted_at).getTime();
        reviewedCount++;
      }
    });

    setStats({
      total: data.length,
      pending: data.filter(k => k.status === 'pending').length,
      approved: data.filter(k => k.status === 'approved').length,
      rejected: data.filter(k => k.status === 'rejected').length,
      avgReviewTime: reviewedCount > 0 ? totalReviewTime / reviewedCount / (1000 * 60 * 60) : 0,
      byCountry,
    });
  };

  const filteredVerifications = useMemo(() => {
    return verifications.filter(kyc => {
      const matchesSearch = searchQuery === '' || 
        kyc.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kyc.profiles?.phone_number?.includes(searchQuery) ||
        kyc.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kyc.id_number.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || kyc.status === statusFilter;
      const matchesCountry = countryFilter === 'all' || kyc.country_code === countryFilter;
      const matchesTier = tierFilter === 'all' || kyc.verification_level === tierFilter;

      return matchesSearch && matchesStatus && matchesCountry && matchesTier;
    });
  }, [verifications, searchQuery, statusFilter, countryFilter, tierFilter]);

  const uniqueCountries = useMemo(() => {
    return [...new Set(verifications.map(k => k.country_code))].sort();
  }, [verifications]);

  const handleApprove = async (kycId: string, tier: string = 'tier_1') => {
    try {
      const verification = verifications.find(v => v.id === kycId);
      if (!verification) return;

      // Update KYC verification
      const { error: kycError } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'approved',
          verified_at: new Date().toISOString(),
          kyc_tier: tier,
          admin_notes: adminNotes || null,
          reviewer_checklist: checklist,
        })
        .eq('id', kycId);

      if (kycError) throw kycError;

      // Update user's profile with new KYC tier
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          kyc_tier: tier,
          kyc_tier_upgraded_at: new Date().toISOString(),
        })
        .eq('id', verification.user_id);

      if (profileError) throw profileError;

      // Award KYC completion points
      await supabase.functions.invoke('award-activity-points', {
        body: {
          user_id: verification.user_id,
          activity_type: 'kyc_completion',
        },
      });

      toast({
        title: 'Success',
        description: `KYC approved at ${getTierDisplayName(tier)} level`,
      });

      setViewDialogOpen(false);
      resetDialogState();
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

  const handleReject = async (kycId: string) => {
    const reason = rejectionReason === 'Other (specify in notes)' 
      ? customRejectionReason 
      : rejectionReason;

    if (!reason) {
      toast({
        title: 'Error',
        description: 'Please select or enter a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          admin_notes: adminNotes || null,
          reviewer_checklist: checklist,
        })
        .eq('id', kycId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'KYC verification rejected',
      });

      setViewDialogOpen(false);
      resetDialogState();
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

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one verification',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updates = Array.from(selectedIds).map(async (id) => {
        const verification = verifications.find(v => v.id === id);
        if (!verification || verification.status !== 'pending') return;

        if (action === 'approve') {
          await supabase
            .from('kyc_verifications')
            .update({
              status: 'approved',
              verified_at: new Date().toISOString(),
              kyc_tier: 'tier_1' as any,
            })
            .eq('id', id);

          await supabase
            .from('profiles')
            .update({
              kyc_tier: 'tier_1' as any,
              kyc_tier_upgraded_at: new Date().toISOString(),
            })
            .eq('id', verification.user_id);
        } else {
          await supabase
            .from('kyc_verifications')
            .update({
              status: 'rejected',
              rejection_reason: 'Bulk rejection - manual review required',
            })
            .eq('id', id);
        }
      });

      await Promise.all(updates);

      toast({
        title: 'Success',
        description: `${selectedIds.size} verification(s) ${action === 'approve' ? 'approved' : 'rejected'}`,
      });

      setSelectedIds(new Set());
      fetchKYCVerifications();
    } catch (error: any) {
      console.error('Error in bulk action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process bulk action',
        variant: 'destructive',
      });
    }
  };

  const viewDetails = (kyc: KYCVerification) => {
    setSelectedKYC(kyc);
    setChecklist(kyc.reviewer_checklist || {});
    setAdminNotes(kyc.admin_notes || '');
    setApprovalTier(kyc.verification_level || 'tier_1');
    setImageZoom(1);
    setImageRotation(0);
    setViewDialogOpen(true);
  };

  const resetDialogState = () => {
    setSelectedKYC(null);
    setChecklist({});
    setAdminNotes('');
    setRejectionReason('');
    setCustomRejectionReason('');
    setApprovalTier('tier_1');
    setImageZoom(1);
    setImageRotation(0);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Country', 'ID Type', 'Status', 'Tier', 'Submitted', 'Verified'];
    const rows = filteredVerifications.map(k => [
      k.full_name,
      k.profiles?.phone_number || '',
      k.profiles?.email || '',
      k.country_code,
      k.id_type,
      k.status,
      getTierDisplayName(k.kyc_tier || 'tier_0'),
      new Date(k.submitted_at).toLocaleDateString(),
      k.verified_at ? new Date(k.verified_at).toLocaleDateString() : '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kyc-verifications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVerifications.filter(k => k.status === 'pending').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVerifications.filter(k => k.status === 'pending').map(k => k.id)));
    }
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

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">High Risk</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500/10 text-yellow-600">Medium Risk</Badge>;
    return <Badge className="bg-success/10 text-success">Low Risk</Badge>;
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
              <p className="text-muted-foreground">Manage user identity verifications with tiered compliance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={fetchKYCVerifications} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-success">{stats.approved}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                    <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Review</p>
                    <p className="text-2xl font-bold">{stats.avgReviewTime.toFixed(1)}h</p>
                  </div>
                  <Shield className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="tier_1">Tier 1</SelectItem>
                  <SelectItem value="tier_2">Tier 2</SelectItem>
                  <SelectItem value="tier_3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="mb-6 border-primary">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm">{selectedIds.size} verification(s) selected</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleBulkAction('approve')} className="bg-success hover:bg-success/90">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Submissions</CardTitle>
            <CardDescription>
              Review and approve or reject user identity verifications ({filteredVerifications.length} results)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={selectedIds.size === filteredVerifications.filter(k => k.status === 'pending').length && selectedIds.size > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVerifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No KYC verifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVerifications.map((kyc) => (
                    <TableRow key={kyc.id}>
                      <TableCell>
                        {kyc.status === 'pending' && (
                          <Checkbox 
                            checked={selectedIds.has(kyc.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedIds);
                              if (checked) {
                                newSet.add(kyc.id);
                              } else {
                                newSet.delete(kyc.id);
                              }
                              setSelectedIds(newSet);
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{kyc.profiles?.phone_number || 'N/A'}</div>
                          <div className="text-muted-foreground text-xs">{kyc.profiles?.email || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{kyc.full_name}</TableCell>
                      <TableCell>{kyc.country_code}</TableCell>
                      <TableCell>{kyc.id_type}</TableCell>
                      <TableCell>
                        <Badge className={getTierColor(kyc.verification_level || 'tier_1')}>
                          {getTierDisplayName(kyc.verification_level || 'tier_1')}
                        </Badge>
                      </TableCell>
                      <TableCell>{getRiskBadge(kyc.risk_score || 0)}</TableCell>
                      <TableCell>{new Date(kyc.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => viewDetails(kyc)}>
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
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setSelectedKYC(kyc);
                                  setViewDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
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

        {/* Detail Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) resetDialogState();
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                KYC Verification Details
              </DialogTitle>
              <DialogDescription>
                Review submitted documents and verification information
              </DialogDescription>
            </DialogHeader>
            
            {selectedKYC && (
              <Tabs defaultValue="documents" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="info">Information</TabsTrigger>
                  <TabsTrigger value="verification">Verification</TabsTrigger>
                  <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="documents" className="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      {/* ID Document */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            ID Document
                          </Label>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))}>
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setImageZoom(z => Math.min(3, z + 0.25))}>
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setImageRotation(r => (r + 90) % 360)}>
                              <RotateCw className="h-4 w-4" />
                            </Button>
                            {selectedKYC.id_document_url && (
                              <Button size="icon" variant="ghost" onClick={() => setFullscreenImage(selectedKYC.id_document_url)}>
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="border rounded-lg overflow-hidden bg-muted/50 h-[300px] flex items-center justify-center">
                          {selectedKYC.id_document_url ? (
                            <img
                              src={selectedKYC.id_document_url}
                              alt="ID Document"
                              className="max-w-full max-h-full object-contain transition-transform"
                              style={{ 
                                transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                              }}
                            />
                          ) : (
                            <p className="text-muted-foreground">No document uploaded</p>
                          )}
                        </div>
                      </div>

                      {/* Selfie */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Selfie with ID
                        </Label>
                        <div className="border rounded-lg overflow-hidden bg-muted/50 h-[300px] flex items-center justify-center">
                          {selectedKYC.selfie_url ? (
                            <img
                              src={selectedKYC.selfie_url}
                              alt="Selfie"
                              className="max-w-full max-h-full object-contain transition-transform"
                              style={{ 
                                transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                              }}
                            />
                          ) : (
                            <p className="text-muted-foreground">No selfie uploaded</p>
                          )}
                        </div>
                      </div>

                      {/* Proof of Address */}
                      {selectedKYC.proof_of_address_url && (
                        <div className="col-span-2 space-y-2">
                          <Label className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Proof of Address
                          </Label>
                          <div className="border rounded-lg overflow-hidden bg-muted/50 h-[200px] flex items-center justify-center">
                            <img
                              src={selectedKYC.proof_of_address_url}
                              alt="Proof of Address"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="info" className="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Full Name</Label>
                        <p className="font-medium">{selectedKYC.full_name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Date of Birth</Label>
                        <p className="font-medium">{new Date(selectedKYC.date_of_birth).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Country</Label>
                        <p className="font-medium">{selectedKYC.country_code}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">ID Type</Label>
                        <p className="font-medium">{selectedKYC.id_type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">ID Number</Label>
                        <p className="font-medium font-mono">{selectedKYC.id_number}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Phone Number</Label>
                        <p className="font-medium">{selectedKYC.profiles?.phone_number || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Address</Label>
                        <p className="font-medium">{selectedKYC.address}</p>
                      </div>
                      {selectedKYC.tax_id && (
                        <div>
                          <Label className="text-muted-foreground text-xs">{selectedKYC.tax_id_type || 'Tax ID'}</Label>
                          <p className="font-medium font-mono">{selectedKYC.tax_id}</p>
                        </div>
                      )}
                      {selectedKYC.occupation && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Occupation</Label>
                          <p className="font-medium">{selectedKYC.occupation}</p>
                        </div>
                      )}
                      {selectedKYC.source_of_funds && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Source of Funds</Label>
                          <p className="font-medium">{selectedKYC.source_of_funds}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground text-xs">Verification Level</Label>
                        <Badge className={getTierColor(selectedKYC.verification_level || 'tier_1')}>
                          {getTierDisplayName(selectedKYC.verification_level || 'tier_1')}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Status</Label>
                        <div>{getStatusBadge(selectedKYC.status)}</div>
                      </div>
                      {selectedKYC.rejection_reason && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Rejection Reason</Label>
                          <p className="font-medium text-destructive">{selectedKYC.rejection_reason}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="verification" className="mt-0 space-y-4">
                    <div>
                      <Label className="mb-2 block">Verification Checklist</Label>
                      <div className="space-y-2">
                        {VERIFICATION_CHECKLIST.map(item => (
                          <div key={item.key} className="flex items-center gap-2">
                            <Checkbox
                              id={item.key}
                              checked={checklist[item.key] || false}
                              onCheckedChange={(checked) => 
                                setChecklist(prev => ({ ...prev, [item.key]: !!checked }))
                              }
                              disabled={selectedKYC.status !== 'pending'}
                            />
                            <label htmlFor={item.key} className="text-sm cursor-pointer">
                              {item.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {selectedKYC.status === 'pending' && (
                      <>
                        <div>
                          <Label>Approval Tier</Label>
                          <Select value={approvalTier} onValueChange={setApprovalTier}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tier_1">Tier 1 - Verified ($500/day)</SelectItem>
                              <SelectItem value="tier_2">Tier 2 - Enhanced ($5,000/day)</SelectItem>
                              <SelectItem value="tier_3">Tier 3 - Premium ($50,000/day)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Rejection Reason (if rejecting)</Label>
                          <Select value={rejectionReason} onValueChange={setRejectionReason}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select reason..." />
                            </SelectTrigger>
                            <SelectContent>
                              {REJECTION_REASONS.map(reason => (
                                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {rejectionReason === 'Other (specify in notes)' && (
                            <Input
                              placeholder="Enter custom reason..."
                              value={customRejectionReason}
                              onChange={(e) => setCustomRejectionReason(e.target.value)}
                              className="mt-2"
                            />
                          )}
                        </div>
                      </>
                    )}

                    <div>
                      <Label>Admin Notes</Label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add internal notes about this verification..."
                        className="mt-1"
                        disabled={selectedKYC.status !== 'pending'}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="risk" className="mt-0 space-y-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Risk Score</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold">{selectedKYC.risk_score || 0}</span>
                          {getRiskBadge(selectedKYC.risk_score || 0)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="mb-2 block">Risk Flags</Label>
                      {selectedKYC.risk_flags && selectedKYC.risk_flags.length > 0 ? (
                        <div className="space-y-2">
                          {selectedKYC.risk_flags.map((flag: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-destructive/10 rounded">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                              <span className="text-sm">{typeof flag === 'string' ? flag : JSON.stringify(flag)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No risk flags detected</p>
                      )}
                    </div>

                    <div>
                      <Label className="mb-2 block">Country Risk</Label>
                      <p className="text-sm">
                        {selectedKYC.country_code === 'NG' && 'Medium - Nigeria requires BVN/NIN verification'}
                        {selectedKYC.country_code === 'ZA' && 'Low - South Africa has strong FICA compliance'}
                        {selectedKYC.country_code === 'KE' && 'Low - Kenya has established KYC framework'}
                        {selectedKYC.country_code === 'GH' && 'Medium - Ghana requires Ghana Card verification'}
                        {!['NG', 'ZA', 'KE', 'GH'].includes(selectedKYC.country_code) && 'Standard risk level'}
                      </p>
                    </div>
                  </TabsContent>
                </ScrollArea>

                {selectedKYC.status === 'pending' && (
                  <DialogFooter className="mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedKYC.id)}
                      disabled={!rejectionReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedKYC.id, approvalTier)}
                      className="bg-success hover:bg-success/90"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve as {getTierDisplayName(approvalTier)}
                    </Button>
                  </DialogFooter>
                )}
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Fullscreen Image Dialog */}
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            {fullscreenImage && (
              <img
                src={fullscreenImage}
                alt="Document"
                className="w-full h-full object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminKYC;
