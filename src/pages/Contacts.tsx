import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Search, RefreshCw, Shield, FileText, Upload, Download, HelpCircle, ChevronDown, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MobileNav from "@/components/MobileNav";
import { useRewardTracking } from "@/hooks/useRewardTracking";
import { parseVCardFile, parseCSVFile, downloadContactsAsVCard } from "@/utils/contactFileParser";
import { saveContactsToDatabase } from "@/utils/contactSync";

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
  const [isImporting, setIsImporting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [contactPickerAvailable, setContactPickerAvailable] = useState(false);
  const { trackActivity } = useRewardTracking();
  
  const vcardInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    // Check if Contact Picker API is available
    const isAvailable = 'contacts' in navigator && 'ContactsManager' in window;
    setContactPickerAvailable(isAvailable);
    console.log('[Contacts] Contact Picker API available:', isAvailable);
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
    console.log("Loading contacts for user:", uid);
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", uid);

    console.log(`Found ${contactsData?.length || 0} contacts in database`);

    if (contactsData) {
      const enrichedContacts = await Promise.all(
        contactsData.map(async (contact) => {
          const { data: registryData, error: lookupError } = await supabase
            .rpc("lookup_user_by_phone", { phone: contact.contact_phone });

          if (lookupError) {
            console.error(`Lookup error for ${contact.contact_phone}:`, lookupError);
          }

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
      
      console.log(`Enriched contacts: ${enrichedContacts.filter(c => c.isFinMoUser).length} FinMo users out of ${enrichedContacts.length} total`);
      setContacts(enrichedContacts);
    }
  };

  const handleSyncContacts = async () => {
    if (!userId) {
      toast.error("Please log in to sync contacts");
      return;
    }

    setIsImporting(true);
    
    try {
      const { syncPhoneContacts, saveContactsToDatabase } = await import("@/utils/contactSync");
      
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);
      
      const isFirstSync = count === 0;
      
      const syncedContacts = await syncPhoneContacts();
      
      if (syncedContacts.length > 0) {
        toast.info(`Saving ${syncedContacts.length} contacts...`);
        await saveContactsToDatabase(syncedContacts);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadContacts(userId);
        
        toast.success(`Successfully synced ${syncedContacts.length} contacts!`);
        
        if (isFirstSync) {
          console.log("Awarding contact sync points...");
          await trackActivity('contact_sync');
        }
      } else {
        toast.info("No contacts were selected. Try importing a vCard or CSV file instead.");
        setShowHelp(true);
      }
    } catch (error) {
      console.error("Contact sync error:", error);
      
      if (error instanceof Error && error.message === 'CONTACT_PICKER_UNAVAILABLE') {
        toast.info("Contact picker not supported", {
          description: "Your browser doesn't support direct contact access. Use Import vCard or CSV below.",
          duration: 6000
        });
        setShowHelp(true);
      } else {
        toast.error("Failed to sync contacts", {
          description: error instanceof Error ? error.message : "An unexpected error occurred"
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleVCardImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    
    setIsImporting(true);
    try {
      console.log('[Contacts] Importing vCard file:', file.name);
      const parsedContacts = await parseVCardFile(file);
      
      if (parsedContacts.length === 0) {
        toast.error("No contacts found in vCard file");
        return;
      }
      
      toast.info(`Found ${parsedContacts.length} contacts, saving...`);
      const result = await saveContactsToDatabase(parsedContacts);
      
      await loadContacts(userId);
      toast.success(`Imported ${result.saved} contacts from vCard${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
      
      // Award points for first sync
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId);
      
      if (count === result.saved) {
        await trackActivity('contact_sync');
      }
    } catch (error) {
      console.error('[Contacts] vCard import error:', error);
      toast.error("Failed to import vCard", {
        description: error instanceof Error ? error.message : "Invalid file format"
      });
    } finally {
      setIsImporting(false);
      if (vcardInputRef.current) vcardInputRef.current.value = '';
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    
    setIsImporting(true);
    try {
      console.log('[Contacts] Importing CSV file:', file.name);
      const parsedContacts = await parseCSVFile(file);
      
      if (parsedContacts.length === 0) {
        toast.error("No contacts found in CSV file");
        return;
      }
      
      toast.info(`Found ${parsedContacts.length} contacts, saving...`);
      const result = await saveContactsToDatabase(parsedContacts);
      
      await loadContacts(userId);
      toast.success(`Imported ${result.saved} contacts from CSV${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
    } catch (error) {
      console.error('[Contacts] CSV import error:', error);
      toast.error("Failed to import CSV", {
        description: error instanceof Error ? error.message : "Invalid file format"
      });
    } finally {
      setIsImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleExportContacts = () => {
    if (contacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }
    
    downloadContactsAsVCard(contacts);
    toast.success(`Exported ${contacts.length} contacts to vCard file`);
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

        {/* Primary Sync Button */}
              {contactPickerAvailable ? (
                <Button
                  onClick={handleSyncContacts}
                  disabled={isImporting}
                  className="w-full bg-white/20 hover:bg-white/30 text-primary-foreground border border-white/30 h-10 sm:h-11 font-medium mb-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Select from Phone Contacts
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-center text-sm text-primary-foreground/70 py-2 mb-2">
                  Use Import vCard or CSV below to add contacts
                </p>
              )}

        {/* Secondary Import Options */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => vcardInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 text-primary-foreground hover:bg-white/20 text-xs h-9"
          >
            <FileText className="w-3 h-3 mr-1" />
            Import vCard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => csvInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 text-primary-foreground hover:bg-white/20 text-xs h-9"
          >
            <Upload className="w-3 h-3 mr-1" />
            Import CSV
          </Button>
          {contacts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportContacts}
              className="flex-1 text-primary-foreground hover:bg-white/20 text-xs h-9"
            >
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={vcardInputRef}
          type="file"
          accept=".vcf,.vcard,text/vcard"
          onChange={handleVCardImport}
          className="hidden"
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCSVImport}
          className="hidden"
        />
      </div>

      {/* Help Instructions */}
      <div className="px-4 pt-4">
        <Collapsible open={showHelp} onOpenChange={setShowHelp}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span>How to export contacts from your phone</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted/30 rounded-lg text-sm space-y-2">
            <p className="font-medium text-foreground">Export as vCard (.vcf):</p>
            <p><strong>iPhone:</strong> Contacts app → Select contacts → Share → Export vCard</p>
            <p><strong>Android:</strong> Contacts app → Menu (⋮) → Settings → Export → Share as .vcf</p>
            <p><strong>Google Contacts:</strong> contacts.google.com → Select → Export → vCard</p>
            <p className="text-xs text-muted-foreground mt-2">After exporting, share the file to yourself (email, drive) then upload it here.</p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Contact List */}
      <div className="px-4 pt-2 pb-4 space-y-3">
        {filteredContacts.length === 0 ? (
          <Card className="shadow-finmo-sm">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">No contacts found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Select from Phone Contacts" or import a vCard/CSV file
              </p>
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
