import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, Globe, Info } from "lucide-react";
import { Capacitor } from "@capacitor/core";

const ContactsGuide = () => {
  const isNative = Capacitor.isNativePlatform();
  const isContactPickerAvailable = 'contacts' in navigator && 'ContactsManager' in window;

  return (
    <Card className="shadow-finmo-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          Contact Sync Information
        </CardTitle>
        <CardDescription>
          How to sync your contacts on different platforms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNative ? (
          <Alert>
            <Smartphone className="w-4 h-4" />
            <AlertDescription>
              <strong>Mobile App</strong>
              <p className="text-sm mt-2">
                When you tap "Sync Contacts", the app will request permission to access your device contacts. 
                After granting permission, your contacts will be imported automatically.
              </p>
            </AlertDescription>
          </Alert>
        ) : isContactPickerAvailable ? (
          <Alert>
            <Globe className="w-4 h-4" />
            <AlertDescription>
              <strong>Web Browser (Contact Picker Supported)</strong>
              <p className="text-sm mt-2">
                Your browser supports contact picking! Click "Sync Contacts" and you'll see a native dialog 
                where you can select which contacts to import. No full access to your contacts is needed.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Globe className="w-4 h-4" />
            <AlertDescription>
              <strong>Web Browser (Limited Support)</strong>
              <p className="text-sm mt-2">
                Your browser doesn't support the Contact Picker API. For the best experience:
              </p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li>Use Chrome, Edge, or another Chromium-based browser on Android</li>
                <li>Or download our mobile app for iOS or Android</li>
                <li>Alternatively, add contacts manually in the Contacts page</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 text-sm">
          <h4 className="font-semibold">Privacy & Security</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Only contacts you explicitly select are imported</li>
            <li>Contact data is stored securely in your account</li>
            <li>You can remove synced contacts anytime</li>
            <li>We never share your contacts with third parties</li>
          </ul>
        </div>

        <div className="space-y-2 text-sm">
          <h4 className="font-semibold">Supported Platforms</h4>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>✅ Android (Mobile App)</div>
            <div>✅ iOS (Mobile App)</div>
            <div>✅ Chrome (Web)</div>
            <div>✅ Edge (Web)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactsGuide;
