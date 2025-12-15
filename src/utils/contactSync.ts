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

// Normalize phone number with enhanced handling for various formats
const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle common formatting issues
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Try to detect country code patterns
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      // US/Canada format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('44') && cleaned.length >= 12) {
      // UK format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('234') && cleaned.length >= 13) {
      // Nigeria format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('254') && cleaned.length >= 12) {
      // Kenya format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('27') && cleaned.length >= 11) {
      // South Africa format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('91') && cleaned.length >= 12) {
      // India format
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('233') && cleaned.length >= 12) {
      // Ghana format
      cleaned = '+' + cleaned;
    } else {
      // Default: assume needs country code
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

// Web Contact Picker API implementation
const syncContactsWeb = async (): Promise<PhoneContact[]> => {
  console.log('[Contact Sync] Checking Contact Picker API availability...');
  console.log('[Contact Sync] navigator.contacts:', 'contacts' in navigator);
  console.log('[Contact Sync] window.ContactsManager:', 'ContactsManager' in window);
  console.log('[Contact Sync] User Agent:', navigator.userAgent);
  
  if (!isContactPickerAvailable()) {
    console.warn('[Contact Sync] Contact Picker API not available on this browser/device');
    // Throw error to signal caller to show file import fallback
    throw new Error('CONTACT_PICKER_UNAVAILABLE');
  }

  console.log('[Contact Sync] Contact Picker API is available, opening picker...');
  
  try {
    const props = ['name', 'tel'];
    const opts = { multiple: true };

    // @ts-ignore - Contact Picker API types may not be fully available
    const contacts = await navigator.contacts.select(props, opts);
    
    console.log('[Contact Sync] Raw contacts received:', contacts?.length || 0);
    
    const phoneContacts: PhoneContact[] = [];

    contacts.forEach((contact: any) => {
      const name = contact.name?.[0] || 'Unknown';
      
      contact.tel?.forEach((phone: string) => {
        if (phone) {
          const normalizedPhone = normalizePhoneNumber(phone);
          phoneContacts.push({
            name,
            phoneNumber: normalizedPhone,
          });
          console.log('[Contact Sync] Added contact:', name, normalizedPhone);
        }
      });
    });

    console.log(`[Contact Sync] Synced ${phoneContacts.length} contacts from web`);
    return phoneContacts;
  } catch (error: any) {
    // User cancelled the picker
    if (error.name === 'AbortError') {
      console.log('[Contact Sync] User cancelled contact selection');
      return [];
    }
    
    console.error('[Contact Sync] Error syncing contacts from web:', error);
    console.error('[Contact Sync] Error name:', error.name);
    console.error('[Contact Sync] Error message:', error.message);
    
    throw error;
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
          const normalizedPhone = normalizePhoneNumber(phone.number);
          phoneContacts.push({
            name,
            phoneNumber: normalizedPhone,
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
  // Check platform and use appropriate method
  if (Capacitor.isNativePlatform()) {
    // Use Capacitor for mobile
    return await syncContactsMobile();
  } else {
    // Use Contact Picker API for web - let errors propagate to caller
    return await syncContactsWeb();
  }
};

// Save contacts to Supabase database with validation
export const saveContactsToDatabase = async (contacts: PhoneContact[]): Promise<{ saved: number; skipped: number }> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("User must be authenticated to save contacts");
  }

  console.log(`Attempting to save ${contacts.length} contacts to database`);
  
  // Filter and validate contacts
  const validatedContacts: Array<{ name: string; phoneNumber: string }> = [];
  const invalidContacts: Array<{ name: string; phoneNumber: string; error: string }> = [];

  for (const contact of contacts) {
    if (!contact.name || !contact.phoneNumber) {
      continue; // Skip empty entries
    }

    // Normalize and attempt auto-correction
    const normalizedPhone = normalizePhoneNumber(contact.phoneNumber);
    const correctedPhone = autoCorrectPhoneNumber(normalizedPhone);
    const validation = validateE164PhoneNumber(correctedPhone);

    if (validation.valid && validation.normalized) {
      validatedContacts.push({
        name: contact.name,
        phoneNumber: validation.normalized
      });
    } else {
      // Try alternative normalization
      const altPhone = autoCorrectPhoneNumber(contact.phoneNumber);
      const altValidation = validateE164PhoneNumber(altPhone);
      
      if (altValidation.valid && altValidation.normalized) {
        validatedContacts.push({
          name: contact.name,
          phoneNumber: altValidation.normalized
        });
      } else {
        invalidContacts.push({
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          error: validation.error || altValidation.error || "Invalid format"
        });
      }
    }
  }

  console.log(`Validated: ${validatedContacts.length} valid, ${invalidContacts.length} invalid contacts`);

  if (invalidContacts.length > 0) {
    console.warn("Invalid contacts skipped:", invalidContacts.slice(0, 5)); // Log first 5
  }

  if (validatedContacts.length === 0) {
    if (invalidContacts.length > 0) {
      throw new Error(`No valid contacts found. ${invalidContacts.length} contacts had invalid phone numbers.`);
    }
    console.log("No valid contacts to save");
    return { saved: 0, skipped: invalidContacts.length };
  }

  // Deduplicate by phone number (keep first occurrence)
  const uniqueContacts = validatedContacts.reduce((acc, contact) => {
    if (!acc.find(c => c.phoneNumber === contact.phoneNumber)) {
      acc.push(contact);
    }
    return acc;
  }, [] as typeof validatedContacts);

  // Prepare contacts for insertion with normalized phone numbers
  const contactsToInsert = uniqueContacts.map(contact => ({
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

  const savedCount = uniqueContacts.length;
  const skippedCount = invalidContacts.length + (validatedContacts.length - uniqueContacts.length);

  console.log(`Successfully saved ${savedCount} contacts${skippedCount > 0 ? ` (${skippedCount} skipped due to invalid format or duplicates)` : ""}`);
  
  return { saved: savedCount, skipped: skippedCount };
};

// Check if a contact is on FinMo
export const checkContactsOnFinMo = async (phones: string[]): Promise<Set<string>> => {
  const finmoUsers = new Set<string>();
  
  try {
    // Normalize all phone numbers
    const normalizedPhones = phones.map(p => normalizePhoneNumber(p));
    
    // Check in batches of 50
    const batchSize = 50;
    for (let i = 0; i < normalizedPhones.length; i += batchSize) {
      const batch = normalizedPhones.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('user_registry')
        .select('phone_number')
        .in('phone_number', batch);
      
      if (!error && data) {
        data.forEach(user => finmoUsers.add(user.phone_number));
      }
    }
  } catch (error) {
    console.error('Error checking contacts on FinMo:', error);
  }
  
  return finmoUsers;
};
