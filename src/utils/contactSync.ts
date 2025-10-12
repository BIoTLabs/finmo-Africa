import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const saveContactsToDatabase = async (contacts: PhoneContact[]): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error('You must be logged in to save contacts');
      return;
    }

    // Insert contacts one by one, ignoring duplicates
    const insertPromises = contacts.map(async (contact) => {
      const { error } = await supabase
        .from('contacts')
        .upsert({
          user_id: user.id,
          contact_name: contact.name,
          contact_phone: contact.phoneNumber,
        }, {
          onConflict: 'user_id,contact_phone',
          ignoreDuplicates: true,
        });

      if (error && error.code !== '23505') { // Ignore unique violation errors
        console.error('Error saving contact:', error);
      }
    });

    await Promise.all(insertPromises);
    toast.success(`Synced ${contacts.length} contacts successfully`);
  } catch (error) {
    console.error('Error saving contacts to database:', error);
    toast.error('Failed to save contacts to database');
  }
};
