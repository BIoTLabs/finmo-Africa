import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, RefreshCw, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isFinMoUser: boolean;
  walletAddress?: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserId(session.user.id);
    await loadContacts(session.user.id);
  };

  const loadContacts = async (uid: string) => {
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", uid);

    if (contactsData) {
      const enrichedContacts = await Promise.all(
        contactsData.map(async (contact) => {
          // Use secure lookup function to check if contact is a FinMo user
          const { data: registryData } = await supabase
            .rpc("lookup_user_by_phone", { phone: contact.contact_phone });

          const userInfo = registryData && registryData.length > 0 ? registryData[0] : null;

          return {
            id: contact.id,
            name: contact.contact_name,
            phone: contact.contact_phone,
            isFinMoUser: !!userInfo,
            walletAddress: userInfo?.wallet_address,
          };
        })
      );
      setContacts(enrichedContacts);
    }
  };

  const handleSyncContacts = () => {
    setShowPermissionDialog(true);
  };

  const handlePermissionGrant = async () => {
    setShowPermissionDialog(false);
    
    // Add some demo contacts
    if (userId) {
      const demoContacts = [
        { contact_name: "Adebayo Johnson", contact_phone: "+234 801 234 5678" },
        { contact_name: "Amina Mohammed", contact_phone: "+234 802 345 6789" },
      ];

      for (const contact of demoContacts) {
        await supabase
          .from("contacts")
          .upsert({ user_id: userId, ...contact }, { onConflict: "user_id,contact_phone" });
      }

      await loadContacts(userId);
      toast.success("Contacts synced successfully!");
    }
  };

  const handlePermissionDeny = () => {
    setShowPermissionDialog(false);
    toast.error("Contact sync permission denied");
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground p-4 sm:p-6 rounded-b-3xl shadow-finmo-lg">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/20 w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Your Contacts</h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 opacity-60" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 sm:pl-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-white/60 h-11 sm:h-12"
          />
        </div>

        {/* Sync Button - Optimized for Mobile */}
        <Button
          onClick={handleSyncContacts}
          className="w-full bg-white/20 hover:bg-white/30 text-primary-foreground border border-white/30 h-10 sm:h-11 font-medium"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Phone Contacts
        </Button>
      </div>

      {/* Contact List */}
      <div className="px-4 pt-4 pb-4 space-y-3">
        {filteredContacts.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">No contacts found</p>
              <p className="text-xs text-muted-foreground mt-1">Sync your contacts to get started</p>
            </CardContent>
          </Card>
        ) : (
          filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              className="shadow-finmo-sm hover:shadow-finmo-md transition-shadow cursor-pointer active:scale-98"
              onClick={() => navigate("/send", { state: { contact } })}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-base sm:text-lg flex-shrink-0">
                      {contact.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base truncate">{contact.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{contact.phone}</p>
                    </div>
                  </div>
                  {contact.isFinMoUser ? (
                    <Badge className="bg-success text-success-foreground flex-shrink-0 text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      <span className="hidden xs:inline">FinMo</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted flex-shrink-0 text-xs">
                      External
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Access Your Contacts?</DialogTitle>
            <DialogDescription className="text-sm">
              FinMo would like to access your contacts to help you find friends who are also using FinMo for instant, fee-free transfers.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={handlePermissionDeny}
            >
              Don't Allow
            </Button>
            <Button
              className="flex-1 bg-gradient-primary hover:opacity-90 h-11"
              onClick={handlePermissionGrant}
            >
              Allow
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <MobileNav />
    </div>
  );
};

export default Contacts;
