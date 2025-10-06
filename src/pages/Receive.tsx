import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, QrCode, Copy, Download, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";

const Receive = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    setProfile(data);
  };

  const copyAddress = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      toast.success("Wallet address copied!");
    }
  };

  const copyPhone = () => {
    if (profile?.phone_number) {
      navigator.clipboard.writeText(profile.phone_number);
      toast.success("Phone number copied!");
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.download = 'finmo-wallet-qr.png';
    link.href = url;
    link.click();
    toast.success("QR code downloaded!");
  };

  const shareQR = async () => {
    if (navigator.share && profile) {
      try {
        await navigator.share({
          title: 'My FinMo Wallet',
          text: `Send money to me on FinMo: ${profile.phone_number}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  if (!profile) return null;

  const qrData = JSON.stringify({
    type: 'finmo_wallet',
    phone: profile.phone_number,
    wallet: profile.wallet_address,
  });

  return (
    <div className="min-h-screen bg-muted pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Receive Money</h1>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm opacity-90 mb-4">Share your details to receive money</p>
            <Button
              onClick={() => setShowQR(true)}
              className="w-full bg-white text-primary hover:bg-white/90"
              size="lg"
            >
              <QrCode className="w-5 h-5 mr-2" />
              Show QR Code
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 space-y-4">
        {/* Phone Number */}
        <Card className="shadow-finmo-md">
          <CardHeader>
            <CardTitle className="text-base">FinMo Phone Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share your phone number for instant, zero-fee transfers
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                {profile.phone_number}
              </code>
              <Button variant="outline" size="icon" onClick={copyPhone}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Address */}
        <Card className="shadow-finmo-md">
          <CardHeader>
            <CardTitle className="text-base">Wallet Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For external blockchain transfers
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all">
                {profile.wallet_address}
              </code>
              <Button variant="outline" size="icon" onClick={copyAddress}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your FinMo QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="p-4 bg-white rounded-xl">
              <QRCodeSVG
                id="qr-code-canvas"
                value={qrData}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this code to send money to<br />
              <span className="font-semibold text-foreground">{profile.phone_number}</span>
            </p>
            <div className="flex gap-2 w-full">
              <Button onClick={downloadQR} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {navigator.share && (
                <Button onClick={shareQR} variant="outline" className="flex-1">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
};

export default Receive;
