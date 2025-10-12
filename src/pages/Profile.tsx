import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Mail, Phone, Share2, Users, CheckCircle2, Clock, X, Smartphone } from "lucide-react";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import ContactsGuide from "@/components/ContactsGuide";
import { syncPhoneContacts, saveContactsToDatabase } from "@/utils/contactSync";

interface Profile {
  id: string;
  phone_number: string;
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
  socials: any;
}

interface Contact {
  id: string;
  contact_name: string;
  contact_phone: string;
  is_on_finmo?: boolean;
  wallet_address?: string;
}

interface Invitation {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [socials, setSocials] = useState({
    twitter: "",
    instagram: "",
    linkedin: "",
    facebook: "",
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      setProfile(profileData);
      setDisplayName(profileData.display_name || "");
      setBio(profileData.bio || "");
      setEmail(profileData.email || "");
      const socialsData = profileData.socials as any || {};
      setSocials({
        twitter: socialsData.twitter || "",
        instagram: socialsData.instagram || "",
        linkedin: socialsData.linkedin || "",
        facebook: socialsData.facebook || "",
      });

      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id);

      if (contactsError) throw contactsError;

      // Check which contacts are on FinMo
      const enrichedContacts = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: registryData } = await supabase
            .rpc("lookup_user_by_phone", { phone: contact.contact_phone });

          const registryArray = registryData as any[];
          const registry = registryArray?.[0];

          return {
            ...contact,
            is_on_finmo: !!registry,
            wallet_address: registry?.wallet_address,
          };
        })
      );

      setContacts(enrichedContacts);

      // Load invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("contact_invitations")
        .select("*")
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });

      if (invitationsError) throw invitationsError;
      setInvitations(invitationsData || []);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          bio: bio,
          email: email,
          socials: socials,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
      await loadProfileData();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleInviteContact = async (contact: Contact) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert invitation record
      const { error: dbError } = await supabase
        .from("contact_invitations")
        .insert({
          inviter_id: user.id,
          contact_phone: contact.contact_phone,
          contact_name: contact.contact_name,
        });

      if (dbError) {
        if (dbError.code === "23505") {
          toast.info("You've already invited this contact");
        } else {
          throw dbError;
        }
        return;
      }

      // Send SMS invitation
      const inviterName = displayName || profile?.phone_number || "A friend";
      
      const { error: smsError } = await supabase.functions.invoke("send-invitation-sms", {
        body: {
          contactName: contact.contact_name,
          contactPhone: contact.contact_phone,
          inviterName: inviterName,
        },
      });

      if (smsError) {
        console.error("Error sending SMS:", smsError);
        toast.success(`Invitation saved for ${contact.contact_name}`, {
          description: "SMS delivery failed, but they'll see the invitation when they sign up"
        });
      } else {
        toast.success(`Invitation sent to ${contact.contact_name}!`, {
          description: "They'll receive an SMS with a link to join FinMo"
        });
      }

      await loadProfileData();
    } catch (error: any) {
      console.error("Error inviting contact:", error);
      toast.error("We couldn't send the invitation. Please try again.");
    }
  };

  const handleSyncContacts = async () => {
    setSyncing(true);
    try {
      const phoneContacts = await syncPhoneContacts();
      
      if (phoneContacts.length === 0) {
        setSyncing(false);
        return;
      }

      await saveContactsToDatabase(phoneContacts);
      await loadProfileData(); // Reload contacts after syncing
    } catch (error) {
      console.error("Error syncing contacts:", error);
      toast.error("Failed to sync contacts");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gradient-subtle p-4 pb-20 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Profile Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                  {displayName?.[0]?.toUpperCase() || profile?.phone_number?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">
              {displayName || profile?.phone_number}
            </CardTitle>
            <CardDescription className="flex items-center justify-center gap-2 mt-2">
              <Phone className="w-4 h-4" />
              {profile?.phone_number}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>

                <Separator />

                <div>
                  <Label className="flex items-center gap-2 mb-4">
                    <Share2 className="w-4 h-4" />
                    Social Links
                  </Label>
                  <div className="space-y-3">
                    <Input
                      placeholder="Twitter username"
                      value={socials.twitter || ""}
                      onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                    />
                    <Input
                      placeholder="Instagram username"
                      value={socials.instagram || ""}
                      onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                    />
                    <Input
                      placeholder="LinkedIn profile URL"
                      value={socials.linkedin || ""}
                      onChange={(e) => setSocials({ ...socials, linkedin: e.target.value })}
                    />
                    <Input
                      placeholder="Facebook profile URL"
                      value={socials.facebook || ""}
                      onChange={(e) => setSocials({ ...socials, facebook: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full bg-gradient-primary"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            {/* Sync Action Card */}
            <Card className="bg-gradient-primary text-primary-foreground overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
              <CardHeader className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 flex items-center gap-2">
                      <Smartphone className="w-5 h-5" />
                      Sync Your Contacts
                    </CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                      Connect with friends on FinMo and make instant transfers
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSyncContacts}
                    disabled={syncing}
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 shadow-finmo-sm"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    {syncing ? "Syncing..." : "Sync Now"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* How it works guide */}
            <ContactsGuide />

            {/* Contacts List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Your Contacts ({contacts.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-primary/10 flex items-center justify-center">
                      <Users className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Contacts Yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      Sync your phone contacts to see which of your friends are using FinMo
                    </p>
                    <Button
                      onClick={handleSyncContacts}
                      disabled={syncing}
                      size="lg"
                      className="bg-gradient-primary"
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      {syncing ? "Syncing..." : "Sync Phone Contacts"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact, index) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-finmo-sm transition-all duration-200 animate-fade-in group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="relative">
                            <Avatar className="w-12 h-12 border-2 border-border">
                              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                                {contact.contact_name[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {contact.is_on_finmo && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center border-2 border-background">
                                <CheckCircle2 className="w-3 h-3 text-success-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {contact.contact_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {contact.contact_phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {contact.is_on_finmo ? (
                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              On FinMo
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInviteContact(contact)}
                              className="group-hover:border-primary group-hover:text-primary"
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Invite
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations" className="space-y-4">
            {/* Invitation Stats Card */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{invitations.length}</p>
                      <p className="text-xs text-muted-foreground">Total Sent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {invitations.filter(i => i.status === 'accepted').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Accepted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invitations List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Invitation History
                </CardTitle>
                <CardDescription>
                  Track who you've invited to join FinMo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-primary/10 flex items-center justify-center">
                      <Mail className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Invitations Yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      Invite your contacts from the Contacts tab to help them discover FinMo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((invitation, index) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-finmo-sm transition-all duration-200 animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="relative">
                            <Avatar className="w-12 h-12 border-2 border-border">
                              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                                {invitation.contact_name[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {invitation.status === "accepted" && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center border-2 border-background">
                                <CheckCircle2 className="w-3 h-3 text-success-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {invitation.contact_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {invitation.contact_phone}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sent {new Date(invitation.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={invitation.status === "accepted" ? "default" : "secondary"}
                          className={
                            invitation.status === "accepted" 
                              ? "bg-success/10 text-success border-success/20" 
                              : "bg-muted"
                          }
                        >
                          {invitation.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                          {invitation.status === "accepted" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {invitation.status === "cancelled" && <X className="w-3 h-3 mr-1" />}
                          <span className="capitalize">{invitation.status}</span>
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
