import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateE164PhoneNumber, autoCorrectPhoneNumber } from "@/utils/phoneValidation";

export interface PhoneContact {
  name: string;
  phoneNumber: string;
}

// Check if Contact Picker API is available (for web browsers)
const isContactPickerAvailable = (): boolean => {
  return 'contacts' in navigator && 'ContactsManager' in window;
};

export const requestContactsPermission = async (): Promise<boolean> => {
  // For web, the Contact Picker API doesn't require explicit permission request
  // Permission is granted when user interacts with the picker
  if (!Capacitor.isNativePlatform()) {
    return isContactPickerAvailable();
  }

  // For mobile, request Capacitor permission
  try {
    const permission = await Contacts.requestPermissions();
    return permission.contacts === 'granted';
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    toast.error('Failed to request contacts permission');
    return false;
  }
};

// Web Contact Picker API implementation
const syncContactsWeb = async (): Promise<PhoneContact[]> => {
  try {
    if (!isContactPickerAvailable()) {
      toast.error('Contact Picker not supported', {
        description: 'Your browser doesn\'t support contact picking. Please use Chrome, Edge, or a Chromium-based browser.'
      });
      return [];
    }

    const props = ['name', 'tel'];
    const opts = { multiple: true };

    // @ts-ignore - Contact Picker API types may not be fully available
    const contacts = await navigator.contacts.select(props, opts);
    
    const phoneContacts: PhoneContact[] = [];

    contacts.forEach((contact: any) => {
      const name = contact.name?.[0] || 'Unknown';
      
      contact.tel?.forEach((phone: string) => {
        if (phone) {
          phoneContacts.push({
            name,
            phoneNumber: phone.replace(/\s+/g, ''), // Remove spaces
          });
        }
      });
    });

    console.log(`Synced ${phoneContacts.length} contacts from web`);
    return phoneContacts;
  } catch (error: any) {
    // User cancelled the picker
    if (error.name === 'AbortError') {
      console.log('User cancelled contact selection');
      return [];
    }
    
    console.error('Error syncing contacts from web:', error);
    toast.error('Failed to sync contacts', {
      description: error.message || 'An error occurred while accessing contacts'
    });
    return [];
  }
};

// Mobile Capacitor implementation
const syncContactsMobile = async (): Promise<PhoneContact[]> => {
  try {
    console.log('Requesting contacts permission...');
    const hasPermission = await requestContactsPermission();
    
    if (!hasPermission) {
      toast.error('Contacts permission was denied', {
        description: 'Please enable contacts access in your device settings to use this feature'
      });
      return [];
    }

    console.log('Permission granted, fetching contacts...');
    const result = await Contacts.getContacts({
      projection: {
        name: true,
        phones: true,
      }
    });

    const phoneContacts: PhoneContact[] = [];

    result.contacts.forEach((contact) => {
      const name = contact.name?.display || 'Unknown';
      
      contact.phones?.forEach((phone) => {
        if (phone.number) {
          phoneContacts.push({
            name,
            phoneNumber: phone.number.replace(/\s+/g, ''), // Remove spaces
          });
        }
      });
    });

    console.log(`Synced ${phoneContacts.length} contacts from mobile`);
    return phoneContacts;
  } catch (error) {
    console.error('Error syncing contacts from mobile:', error);
    toast.error('Failed to sync contacts', {
      description: error instanceof Error ? error.message : 'An unknown error occurred'
    });
    return [];
  }
};

export const syncPhoneContacts = async (): Promise<PhoneContact[]> => {
  try {
    // Check platform and use appropriate method
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor for mobile
      return await syncContactsMobile();
    } else {
      // Use Contact Picker API for web
      if (!isContactPickerAvailable()) {
        toast.info('Contact sync on web', {
          description: 'Contact syncing on web browsers requires user interaction. Click "Sync Contacts" to select contacts to import.',
          duration: 5000,
        });
      }
      return await syncContactsWeb();
    }
  } catch (error) {
    console.error('Error syncing contacts:', error);
    toast.error('Failed to sync contacts', {
      description: error instanceof Error ? error.message : 'An unknown error occurred'
    });
    return [];
  }
};

// Save contacts to Supabase database with validation
export const saveContactsToDatabase = async (contacts: PhoneContact[]): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("User must be authenticated to save contacts");
  }

  console.log(`Attempting to save ${contacts.length} contacts to database`);
  
  // Filter and validate contacts
  const validatedContacts: Array<{ name: string; phoneNumber: string; isValid: boolean; error?: string }> = [];
  const invalidContacts: Array<{ name: string; phoneNumber: string; error: string }> = [];

  contacts.forEach(contact => {
    if (!contact.name || !contact.phoneNumber) {
      return; // Skip empty entries
    }

    // Attempt auto-correction
    const correctedPhone = autoCorrectPhoneNumber(contact.phoneNumber);
    const validation = validateE164PhoneNumber(correctedPhone);

    if (validation.valid && validation.normalized) {
      validatedContacts.push({
        name: contact.name,
        phoneNumber: validation.normalized,
        isValid: true
      });
    } else {
      invalidContacts.push({
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        error: validation.error || "Invalid format"
      });
    }
  });

  console.log(`Validated: ${validatedContacts.length} valid, ${invalidContacts.length} invalid contacts`);

  if (invalidContacts.length > 0) {
    console.warn("Invalid contacts skipped:", invalidContacts.slice(0, 5)); // Log first 5
  }

  if (validatedContacts.length === 0) {
    if (invalidContacts.length > 0) {
      throw new Error(`No valid contacts found. ${invalidContacts.length} contacts had invalid phone numbers.`);
    }
    console.log("No valid contacts to save");
    return;
  }

  // Prepare contacts for insertion with normalized phone numbers
  const contactsToInsert = validatedContacts.map(contact => ({
    user_id: session.user.id,
    contact_name: contact.name,
    contact_phone: contact.phoneNumber,
  }));

  const { error } = await supabase
    .from("contacts")
    .upsert(contactsToInsert, { 
      onConflict: "user_id,contact_phone",
      ignoreDuplicates: true 
    });

  if (error) {
    console.error("Database error:", error);
    throw new Error("Failed to save contacts to database");
  }

  console.log(`Successfully saved ${validatedContacts.length} contacts${invalidContacts.length > 0 ? ` (${invalidContacts.length} skipped due to invalid format)` : ""}`);
};
