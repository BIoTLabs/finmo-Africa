import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";
import { useRewardTracking } from "@/hooks/useRewardTracking";

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const { trackActivity } = useRewardTracking();

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

  const handleSyncContacts = async () => {
    if (!userId) {
      toast.error("Please log in to sync contacts");
      return;
    }
    
    try {
      const { syncPhoneContacts, saveContactsToDatabase } = await import("@/utils/contactSync");
      
      toast.info("Opening contact picker...");
      const contacts = await syncPhoneContacts();
      
      if (contacts.length > 0) {
        toast.info(`Saving ${contacts.length} contacts...`);
        const isFirstSync = (await supabase.from("contacts").select("*", { count: 'exact', head: true }).eq("user_id", userId)).count === 0;
        
        await saveContactsToDatabase(contacts);
        await loadContacts(userId);
        toast.success(`Successfully synced ${contacts.length} contacts!`);
        
        // Award points for first contact sync
        if (isFirstSync) {
          await trackActivity('contact_sync');
        }
      } else {
        toast.info("No contacts were selected");
      }
    } catch (error) {
      console.error("Contact sync error:", error);
      toast.error("Failed to sync contacts", {
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
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
      <MobileNav />
    </div>
  );
};

export default Contacts;
