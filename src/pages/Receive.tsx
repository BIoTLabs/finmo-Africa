import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, Copy, Download, Share2, Network } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MobileNav from "@/components/MobileNav";
import { SUPPORTED_CHAINS } from "@/utils/blockchain";

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
    const svg = document.getElementById('qr-code-svg');
    if (!svg || !(svg instanceof SVGElement)) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'finmo-wallet-qr.png';
      link.href = url;
      link.click();
      toast.success("QR code downloaded!");
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
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

  const qrData = `FinMo Wallet
Phone: ${profile.phone_number}
ERC-20: ${profile.wallet_address}
Type: finmo_wallet`;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 flex-shrink-0"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Receive Money</h1>
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
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="w-4 h-4" />
              Wallet Address (Multi-Chain)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your wallet supports {Object.keys(SUPPORTED_CHAINS).length} blockchain networks and multiple tokens including USDC, USDT, DAI, WBTC, WETH, LINK, BUSD, and native tokens
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all">
                  {profile.wallet_address}
                </code>
                <Button variant="outline" size="icon" onClick={copyAddress}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Supported Networks */}
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Supported Networks:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(SUPPORTED_CHAINS).map((chain) => (
                  <Badge key={chain.chainId} variant="secondary" className="text-xs">
                    {chain.name.replace(' Testnet', '').replace(' Sepolia', '')}
                  </Badge>
                ))}
              </div>
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
                id="qr-code-svg"
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
