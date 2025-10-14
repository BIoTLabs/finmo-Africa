import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isFinMoUser: boolean;
  walletAddress?: string;
}

interface ContactSelectorProps {
  onSelectContact: (contact: Contact) => void;
  selectedPhone?: string;
}

export const ContactSelector = ({ onSelectContact, selectedPhone }: ContactSelectorProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", session.user.id)
        .order("contact_name");

      if (contactsData) {
        const enrichedContacts = await Promise.all(
          contactsData.map(async (contact) => {
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
        // Filter to only show FinMo users
        const finmoUsers = enrichedContacts.filter(contact => contact.isFinMoUser);
        setContacts(finmoUsers);
      }
    } catch (error: any) {
      console.error("Error loading contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
  );

  const handleSelectContact = (contact: Contact) => {
    onSelectContact(contact);
    setOpen(false);
    toast.success(`Selected ${contact.name}`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Select Contact
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Select a Contact</SheetTitle>
          <SheetDescription>
            Choose from your synced contacts to send money quickly
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contacts List */}
          <ScrollArea className="h-[calc(80vh-180px)]">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading contacts...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No contacts found" : "No contacts synced yet"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Go to Contacts to sync your phone contacts
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full p-4 rounded-lg border transition-all hover:border-primary hover:bg-accent ${
                      selectedPhone === contact.phone
                        ? "border-primary bg-accent"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                          {contact.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-semibold truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.phone}
                          </p>
                        </div>
                      </div>
                      {contact.isFinMoUser ? (
                        <Badge className="bg-success text-success-foreground flex-shrink-0">
                          <Shield className="w-3 h-3 mr-1" />
                          FinMo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex-shrink-0">
                          External
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
