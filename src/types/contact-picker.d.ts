// Type definitions for Contact Picker API
// https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API

interface ContactProperty {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: any[];
  icon?: Blob[];
}

interface ContactsSelectOptions {
  multiple?: boolean;
}

interface ContactsManager {
  getProperties(): Promise<string[]>;
  select(
    properties: string[],
    options?: ContactsSelectOptions
  ): Promise<ContactProperty[]>;
}

interface Navigator {
  contacts?: ContactsManager;
}

interface Window {
  ContactsManager?: any;
}
