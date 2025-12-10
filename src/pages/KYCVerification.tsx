import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight,
  Shield, AlertTriangle, Camera, FileText, MapPin, Briefcase,
  DollarSign, User, Info
} from "lucide-react";
import { useRewardTracking } from "@/hooks/useRewardTracking";
import { useKYCTiers, useCountryKYCRequirements, useUserKYCTier, getTierDisplayName, getTierColor, type KYCTier, type CountryKYCRequirement } from "@/hooks/useKYCTiers";

const ID_TYPES: Record<string, { value: string; label: string }[]> = {
  NG: [
    { value: 'nin_slip', label: 'NIN Slip' },
    { value: 'voters_card', label: "Voter's Card" },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'international_passport', label: 'International Passport' },
  ],
  ZA: [
    { value: 'sa_id_card', label: 'SA ID Card' },
    { value: 'sa_id_book', label: 'SA ID Book' },
    { value: 'passport', label: 'Passport' },
  ],
  KE: [
    { value: 'national_id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
  ],
  GH: [
    { value: 'ghana_card', label: 'Ghana Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'voters_id', label: "Voter's ID" },
    { value: 'drivers_license', label: "Driver's License" },
  ],
  DEFAULT: [
    { value: 'passport', label: 'Passport' },
    { value: 'national_id', label: 'National ID' },
    { value: 'drivers_license', label: "Driver's License" },
  ],
};

const TAX_ID_LABELS: Record<string, string> = {
  NG: 'BVN (Bank Verification Number)',
  ZA: 'Tax Number',
  KE: 'KRA PIN',
  GH: 'TIN (Tax Identification Number)',
  DEFAULT: 'Tax ID',
};

const SOURCE_OF_FUNDS_OPTIONS = [
  'Employment / Salary',
  'Business Income',
  'Investments',
  'Inheritance',
  'Savings',
  'Pension / Retirement',
  'Gift',
  'Other',
];

export default function KYCVerification() {
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [targetTier, setTargetTier] = useState<string>('tier_1');
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    address: "",
    country_code: "",
    id_type: "",
    id_number: "",
    tax_id: "",
    tax_id_type: "",
    source_of_funds: "",
    occupation: "",
    employer_name: "",
  });
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [sourceOfFundsDoc, setSourceOfFundsDoc] = useState<File | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { trackActivity } = useRewardTracking();
  const { tiers, loading: tiersLoading } = useKYCTiers();
  const { requirements, loading: requirementsLoading } = useCountryKYCRequirements(userCountry);
  const { userTier, limits, loading: userTierLoading } = useUserKYCTier();

  useEffect(() => {
    checkKYCStatus();
    fetchUserCountry();
  }, []);

  const fetchUserCountry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single();

      if (profile?.phone_number) {
        // Extract country from phone number
        if (profile.phone_number.startsWith('+234')) setUserCountry('NG');
        else if (profile.phone_number.startsWith('+27')) setUserCountry('ZA');
        else if (profile.phone_number.startsWith('+254')) setUserCountry('KE');
        else if (profile.phone_number.startsWith('+233')) setUserCountry('GH');
        else setUserCountry('DEFAULT');

        setFormData(prev => ({
          ...prev,
          country_code: profile.phone_number.startsWith('+234') ? 'NG' :
                        profile.phone_number.startsWith('+27') ? 'ZA' :
                        profile.phone_number.startsWith('+254') ? 'KE' :
                        profile.phone_number.startsWith('+233') ? 'GH' : '',
        }));
      }
    } catch (error) {
      console.error('Error fetching user country:', error);
    }
  };

  const checkKYCStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setKycStatus(data);
    } catch (error: any) {
      console.error("Error checking KYC status:", error);
    }
  };

  const currentTierConfig = useMemo(() => {
    return tiers.find(t => t.tier === targetTier);
  }, [tiers, targetTier]);

  const currentRequirements = useMemo(() => {
    return requirements.find(r => r.tier === targetTier);
  }, [requirements, targetTier]);

  const availableIdTypes = useMemo(() => {
    return ID_TYPES[formData.country_code] || ID_TYPES.DEFAULT;
  }, [formData.country_code]);

  const taxIdLabel = useMemo(() => {
    return TAX_ID_LABELS[formData.country_code] || TAX_ID_LABELS.DEFAULT;
  }, [formData.country_code]);

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

      // Validate based on tier requirements
      if (targetTier === 'tier_2' || targetTier === 'tier_3') {
        if (!proofOfAddress) {
          throw new Error("Proof of address is required for this verification tier");
        }
        if (!formData.tax_id) {
          throw new Error(`${taxIdLabel} is required for this verification tier`);
        }
      }

      if (targetTier === 'tier_3') {
        if (!formData.source_of_funds) {
          throw new Error("Source of funds is required for this verification tier");
        }
        if (!formData.occupation) {
          throw new Error("Occupation is required for this verification tier");
        }
      }

      const idDocumentUrl = await uploadFile(idDocument, 'id-documents');
      const selfieUrl = await uploadFile(selfie, 'selfies');
      const proofOfAddressUrl = proofOfAddress ? await uploadFile(proofOfAddress, 'proof-of-address') : null;
      const sourceOfFundsDocUrl = sourceOfFundsDoc ? await uploadFile(sourceOfFundsDoc, 'source-of-funds') : null;

      const insertData: any = {
        user_id: user.id,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        country_code: formData.country_code,
        id_type: formData.id_type,
        id_number: formData.id_number,
        id_document_url: idDocumentUrl,
        selfie_url: selfieUrl,
        proof_of_address_url: proofOfAddressUrl,
        tax_id: formData.tax_id || null,
        tax_id_type: formData.tax_id ? taxIdLabel : null,
        source_of_funds: formData.source_of_funds || null,
        source_of_funds_documents: sourceOfFundsDocUrl ? [sourceOfFundsDocUrl] : null,
        occupation: formData.occupation || null,
        employer_name: formData.employer_name || null,
        verification_level: targetTier,
        kyc_tier: 'tier_0',
      };

      const { error } = await supabase
        .from("kyc_verifications")
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "KYC Submitted",
        description: `Your ${getTierDisplayName(targetTier)} verification has been submitted for review.`,
      });

      await trackActivity('kyc_completion');
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
        return <CheckCircle2 className="h-6 w-6 text-success" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Clock className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getTotalSteps = () => {
    if (targetTier === 'tier_3') return 4;
    if (targetTier === 'tier_2') return 3;
    return 2;
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      return formData.full_name && formData.date_of_birth && formData.country_code;
    }
    if (currentStep === 2) {
      return formData.id_type && formData.id_number && idDocument && selfie;
    }
    if (currentStep === 3) {
      return formData.address && proofOfAddress && formData.tax_id;
    }
    return true;
  };

  // Show status if KYC exists
  if (kycStatus) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate("/settings")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(kycStatus.status)}
              KYC Verification Status
            </CardTitle>
            <CardDescription>
              Requested: <Badge className={getTierColor(kycStatus.verification_level || 'tier_1')}>
                {getTierDisplayName(kycStatus.verification_level || 'tier_1')}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kycStatus.status === 'pending' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your verification is being reviewed. This typically takes 1-2 business days.
                </AlertDescription>
              </Alert>
            )}
            {kycStatus.status === 'approved' && (
              <div className="space-y-4">
                <Alert className="border-success bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    Your account has been verified at {getTierDisplayName(kycStatus.kyc_tier || 'tier_1')} level.
                  </AlertDescription>
                </Alert>

                {limits && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Your Transaction Limits</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Daily Limit</span>
                          <span>${limits.daily_total_usd.toFixed(2)} / ${limits.daily_limit_usd.toFixed(2)}</span>
                        </div>
                        <Progress value={(limits.daily_total_usd / limits.daily_limit_usd) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          ${limits.daily_remaining_usd.toFixed(2)} remaining today
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Monthly Limit</span>
                          <span>${limits.monthly_total_usd.toFixed(2)} / ${limits.monthly_limit_usd.toFixed(2)}</span>
                        </div>
                        <Progress value={(limits.monthly_total_usd / limits.monthly_limit_usd) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          ${limits.monthly_remaining_usd.toFixed(2)} remaining this month
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Upgrade option */}
                {kycStatus.kyc_tier !== 'tier_3' && (
                  <Card className="border-primary/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Want higher limits?</p>
                          <p className="text-sm text-muted-foreground">
                            Upgrade to {getTierDisplayName(kycStatus.kyc_tier === 'tier_1' ? 'tier_2' : 'tier_3')} for increased transaction limits
                          </p>
                        </div>
                        <Button onClick={() => {
                          setKycStatus(null);
                          setTargetTier(kycStatus.kyc_tier === 'tier_1' ? 'tier_2' : 'tier_3');
                        }}>
                          Upgrade
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {kycStatus.status === 'rejected' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your verification was rejected.
                    {kycStatus.rejection_reason && (
                      <span className="block mt-1">Reason: {kycStatus.rejection_reason}</span>
                    )}
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setKycStatus(null)}>Resubmit Verification</Button>
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
    <div className="container max-w-3xl mx-auto p-4">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate("/settings")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Button>
      </div>

      {/* Tier Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Choose Verification Level
          </CardTitle>
          <CardDescription>
            Higher verification levels unlock higher transaction limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.filter(t => t.tier !== 'tier_0').map((tier) => (
              <Card 
                key={tier.tier}
                className={`cursor-pointer transition-all ${targetTier === tier.tier ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                onClick={() => {
                  setTargetTier(tier.tier);
                  setCurrentStep(1);
                }}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getTierColor(tier.tier)}>{tier.name}</Badge>
                    {targetTier === tier.tier && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-2xl font-bold">${tier.daily_limit_usd.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">daily limit</p>
                  <p className="text-sm mt-2">${tier.monthly_limit_usd.toLocaleString()}/month</p>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Requires:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      {tier.required_documents.map((doc, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          {doc.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of {getTotalSteps()}</span>
            <span className="text-sm text-muted-foreground">
              {currentStep === 1 && 'Personal Information'}
              {currentStep === 2 && 'Identity Verification'}
              {currentStep === 3 && 'Address & Tax'}
              {currentStep === 4 && 'Source of Funds'}
            </span>
          </div>
          <Progress value={(currentStep / getTotalSteps()) * 100} />
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {getTierDisplayName(targetTier)} Verification
          </CardTitle>
          <CardDescription>
            Complete all required information for verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Personal Information</h3>
                </div>

                <div>
                  <Label htmlFor="full_name">Full Name (as on ID)</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full legal name"
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
                  <Label htmlFor="country_code">Country</Label>
                  <Select
                    value={formData.country_code}
                    onValueChange={(value) => {
                      setFormData({ ...formData, country_code: value, id_type: '' });
                      setUserCountry(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                      <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                      <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                      <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Identity */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Identity Verification</h3>
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
                      {availableIdTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="id_number">ID Number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    placeholder="Enter your ID number"
                    required
                  />
                </div>

                <div>
                  <Label>ID Document (Front)</Label>
                  <div className="mt-2">
                    <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-6 hover:bg-accent transition-colors">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {idDocument ? idDocument.name : "Upload ID Document"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG or PDF up to 10MB
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Selfie (holding ID next to face)</Label>
                  <div className="mt-2">
                    <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-6 hover:bg-accent transition-colors">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {selfie ? selfie.name : "Upload Selfie"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Clear photo with your face and ID visible
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Address & Tax (Tier 2+) */}
            {currentStep === 3 && (targetTier === 'tier_2' || targetTier === 'tier_3') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Address & Tax Verification</h3>
                </div>

                <div>
                  <Label htmlFor="address">Residential Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter your full residential address"
                    required
                  />
                </div>

                <div>
                  <Label>Proof of Address</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Utility bill, bank statement, or government letter dated within 3 months
                  </p>
                  <div className="mt-2">
                    <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-6 hover:bg-accent transition-colors">
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {proofOfAddress ? proofOfAddress.name : "Upload Proof of Address"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => setProofOfAddress(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tax_id">{taxIdLabel}</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder={`Enter your ${taxIdLabel}`}
                    required
                  />
                  {formData.country_code === 'NG' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your 11-digit Bank Verification Number
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Source of Funds (Tier 3) */}
            {currentStep === 4 && targetTier === 'tier_3' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Source of Funds</h3>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This information helps us comply with anti-money laundering regulations.
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="source_of_funds">Primary Source of Funds</Label>
                  <Select
                    value={formData.source_of_funds}
                    onValueChange={(value) => setFormData({ ...formData, source_of_funds: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source of funds" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OF_FUNDS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    placeholder="Enter your occupation"
                    required
                  />
                </div>

                {formData.source_of_funds === 'Employment / Salary' && (
                  <div>
                    <Label htmlFor="employer_name">Employer Name</Label>
                    <Input
                      id="employer_name"
                      value={formData.employer_name}
                      onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                      placeholder="Enter your employer's name"
                    />
                  </div>
                )}

                <div>
                  <Label>Supporting Documentation (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Bank statement, pay slip, or business registration
                  </p>
                  <div className="mt-2">
                    <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-6 hover:bg-accent transition-colors">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {sourceOfFundsDoc ? sourceOfFundsDoc.name : "Upload Document (Optional)"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => setSourceOfFundsDoc(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              ) : (
                <div />
              )}

              {currentStep < getTotalSteps() ? (
                <Button 
                  type="button" 
                  onClick={() => setCurrentStep(s => s + 1)}
                  disabled={!canProceedToNextStep()}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit for Verification"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
