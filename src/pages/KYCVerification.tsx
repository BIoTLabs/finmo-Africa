import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function KYCVerification() {
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    address: "",
    country_code: "",
    id_type: "",
    id_number: "",
  });
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkKYCStatus();
  }, []);

  const checkKYCStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setKycStatus(data);
    } catch (error: any) {
      console.error("Error checking KYC status:", error);
    }
  };

  const uploadFile = async (file: File, folder: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!idDocument || !selfie) {
        throw new Error("Please upload both ID document and selfie");
      }

      const idDocumentUrl = await uploadFile(idDocument, 'id-documents');
      const selfieUrl = await uploadFile(selfie, 'selfies');

      const { error } = await supabase
        .from("kyc_verifications")
        .insert({
          user_id: user.id,
          ...formData,
          id_document_url: idDocumentUrl,
          selfie_url: selfieUrl,
        });

      if (error) throw error;

      toast({
        title: "KYC Submitted",
        description: "Your verification documents have been submitted for review.",
      });

      checkKYCStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Clock className="h-6 w-6 text-yellow-500" />;
    }
  };

  if (kycStatus) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(kycStatus.status)}
              KYC Verification Status
            </CardTitle>
            <CardDescription>
              Status: <span className="capitalize font-semibold">{kycStatus.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kycStatus.status === 'pending' && (
              <p className="text-sm text-muted-foreground">
                Your verification is being reviewed. This typically takes 1-2 business days.
              </p>
            )}
            {kycStatus.status === 'approved' && (
              <p className="text-sm text-green-600">
                Your account has been verified. You can now make withdrawals.
              </p>
            )}
            {kycStatus.status === 'rejected' && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  Your verification was rejected.
                </p>
                {kycStatus.rejection_reason && (
                  <p className="text-sm text-muted-foreground">
                    Reason: {kycStatus.rejection_reason}
                  </p>
                )}
                <Button onClick={() => setKycStatus(null)}>Resubmit</Button>
              </div>
            )}
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>KYC Verification</CardTitle>
          <CardDescription>
            Complete your identity verification to enable withdrawals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name (as on ID)</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="address">Residential Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="country_code">Country</Label>
              <Input
                id="country_code"
                placeholder="e.g., NG, GH, KE"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div>
              <Label htmlFor="id_type">ID Type</Label>
              <Select
                value={formData.id_type}
                onValueChange={(value) => setFormData({ ...formData, id_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="voters_card">Voter's Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="id_number">ID Number</Label>
              <Input
                id="id_number"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="id_document">ID Document (Front and Back)</Label>
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-accent">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">
                    {idDocument ? idDocument.name : "Upload ID Document"}
                  </span>
                  <input
                    id="id_document"
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                    required
                  />
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="selfie">Selfie (holding ID)</Label>
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-accent">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">
                    {selfie ? selfie.name : "Upload Selfie"}
                  </span>
                  <input
                    id="selfie"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                    required
                  />
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit for Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
