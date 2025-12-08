import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Mail, Phone, Globe, Briefcase, Users, ArrowLeft, CheckCircle } from "lucide-react";

const businessTypes = [
  { value: "fintech", label: "Fintech / Payment Provider" },
  { value: "bank", label: "Bank / Financial Institution" },
  { value: "mobile_money", label: "Mobile Money Operator" },
  { value: "remittance", label: "Remittance Service" },
  { value: "marketplace", label: "Marketplace / E-commerce" },
  { value: "corporate", label: "Corporate / Enterprise" },
  { value: "other", label: "Other" },
];

const countries = [
  { value: "NG", label: "Nigeria" },
  { value: "KE", label: "Kenya" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "TZ", label: "Tanzania" },
  { value: "UG", label: "Uganda" },
  { value: "RW", label: "Rwanda" },
  { value: "ET", label: "Ethiopia" },
  { value: "EG", label: "Egypt" },
  { value: "MA", label: "Morocco" },
  { value: "OTHER", label: "Other" },
];

const volumeRanges = [
  { value: "0-10k", label: "Less than $10,000/month" },
  { value: "10k-50k", label: "$10,000 - $50,000/month" },
  { value: "50k-100k", label: "$50,000 - $100,000/month" },
  { value: "100k-500k", label: "$100,000 - $500,000/month" },
  { value: "500k+", label: "More than $500,000/month" },
];

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    business_type: "",
    country_code: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    expected_volume: "",
    use_case: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.business_type || !formData.contact_email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("partners").insert({
        company_name: formData.company_name,
        business_type: formData.business_type,
        country_code: formData.country_code || null,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
        status: "pending",
        metadata: {
          website: formData.website,
          expected_volume: formData.expected_volume,
          use_case: formData.use_case,
          submitted_at: new Date().toISOString(),
        },
      });

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast.error("A partner with this email already exists");
        } else {
          throw error;
        }
        return;
      }

      setIsSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (error) {
      console.error("Partner registration error:", error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Application Submitted!</CardTitle>
            <CardDescription>
              Thank you for your interest in the Finmo Partner API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We've received your application and will review it within 1-2 business days. 
              You'll receive an email at <strong>{formData.contact_email}</strong> once approved.
            </p>
            <div className="pt-4 space-y-2">
              <Button onClick={() => navigate("/api-docs")} className="w-full">
                View API Documentation
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                Return Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Partner API Application</CardTitle>
                <CardDescription>
                  Join Finmo's Partner API program and integrate stablecoin payments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Information
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    placeholder="Your Company Ltd"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business_type">Business Type *</Label>
                    <Select 
                      value={formData.business_type} 
                      onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {businessTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country_code">Country</Label>
                    <Select 
                      value={formData.country_code} 
                      onValueChange={(value) => setFormData({ ...formData, country_code: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="website"
                      placeholder="https://yourcompany.com"
                      className="pl-10"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contact Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="contact_email"
                        type="email"
                        placeholder="api@yourcompany.com"
                        className="pl-10"
                        value={formData.contact_email}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="contact_phone"
                        placeholder="+234 800 000 0000"
                        className="pl-10"
                        value={formData.contact_phone}
                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Integration Details */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Integration Details
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="expected_volume">Expected Monthly Volume</Label>
                  <Select 
                    value={formData.expected_volume} 
                    onValueChange={(value) => setFormData({ ...formData, expected_volume: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expected volume" />
                    </SelectTrigger>
                    <SelectContent>
                      {volumeRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="use_case">Describe Your Use Case *</Label>
                  <Textarea
                    id="use_case"
                    placeholder="Tell us how you plan to use the Finmo Partner API..."
                    rows={4}
                    value={formData.use_case}
                    onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>
                  By submitting this application, you agree to our{" "}
                  <a href="#" className="text-primary hover:underline">Terms of Service</a> and{" "}
                  <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
