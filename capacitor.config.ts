import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'africa.finmo.app',
  appName: 'FinMo Africa',
  webDir: 'dist',
  server: {
    url: 'https://finmo.africa',
    cleartext: true
  },
  plugins: {
    Contacts: {
      androidPermissions: [
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS'
      ]
    },
    Camera: {
      permissions: ['camera']
    }
  }
};

export default config;
