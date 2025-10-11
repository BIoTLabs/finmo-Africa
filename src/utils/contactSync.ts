import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PhoneContact {
  name: string;
  phoneNumber: string;
}

export const requestContactsPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    toast.error('Contact syncing is only available on mobile devices');
    return false;
  }

  try {
    const permission = await Contacts.requestPermissions();
    return permission.contacts === 'granted';
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    toast.error('Failed to request contacts permission');
    return false;
  }
};

export const syncPhoneContacts = async (): Promise<PhoneContact[]> => {
  try {
    // Check if running on native platform
    if (!Capacitor.isNativePlatform()) {
      toast.error('Contact syncing only works on iOS or Android devices', {
        description: 'Please test this feature by building and running the app on a physical device or emulator'
      });
      return [];
    }

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

    console.log(`Synced ${phoneContacts.length} contacts`);
    return phoneContacts;
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
