import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.39f749dde9834411b0e948f73cf4294c',
  appName: 'memo-pay-africa',
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
