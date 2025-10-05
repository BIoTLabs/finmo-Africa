import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.39f749dde9834411b0e948f73cf4294c',
  appName: 'memo-pay-africa',
  webDir: 'dist',
  server: {
    url: 'https://39f749dd-e983-4411-b0e9-48f73cf4294c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Contacts: {
      androidPermissions: [
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS'
      ]
    }
  }
};

export default config;
