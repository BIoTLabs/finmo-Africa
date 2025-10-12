# Contact Sync Web Implementation Guide

## Overview
The FinMo app now supports contact syncing on both web browsers and mobile apps using two different approaches:

### 1. Web Browser - Contact Picker API
- **Supported Browsers**: Chrome, Edge, and other Chromium-based browsers on Android
- **User Experience**: Native browser dialog for selecting contacts
- **Privacy**: Users explicitly select which contacts to share
- **Permission**: No persistent permission needed - granted per interaction

### 2. Mobile App - Capacitor Contacts Plugin
- **Supported Platforms**: iOS and Android native apps
- **User Experience**: System permission dialog, then automatic sync
- **Privacy**: Full access after permission granted
- **Permission**: One-time permission request, then persistent

## Technical Implementation

### Platform Detection
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Use Capacitor Contacts plugin
} else {
  // Use Contact Picker API
}
```

### Web Contact Picker API
```typescript
// Check availability
const isContactPickerAvailable = 'contacts' in navigator && 'ContactsManager' in window;

// Use the API
const props = ['name', 'tel'];
const opts = { multiple: true };
const contacts = await navigator.contacts.select(props, opts);
```

### Browser Support
| Browser | Support |
|---------|---------|
| Chrome (Android) | ✅ Yes |
| Edge (Android) | ✅ Yes |
| Safari (iOS) | ❌ No |
| Firefox | ❌ No |
| Chrome (Desktop) | ❌ No |

**Note**: The Contact Picker API is primarily supported on Android mobile browsers. Desktop and iOS Safari do not currently support this API.

## User Guide

### For Web Users:
1. Open FinMo in Chrome or Edge browser on Android
2. Navigate to Profile → Contacts tab
3. Click "Sync Phone Contacts"
4. A native browser dialog will appear
5. Select the contacts you want to import
6. Selected contacts will be saved to your FinMo account

### For Mobile App Users:
1. Open FinMo mobile app
2. Navigate to Profile → Contacts tab
3. Click "Sync Phone Contacts"
4. Grant contacts permission when prompted
5. All contacts will be imported automatically

## Privacy & Security

### What We Store:
- Contact name
- Phone number(s)
- Whether the contact is on FinMo

### What We DON'T Store:
- Email addresses
- Physical addresses
- Photos
- Other contact metadata

### Security Measures:
- All contact data is stored encrypted in the database
- Row-level security ensures users can only access their own contacts
- Phone numbers are hashed for privacy
- Contacts can be deleted at any time

## Error Handling

### Common Scenarios:
1. **User Cancels Selection**: Silent failure, no error shown
2. **Browser Not Supported**: Info toast with alternative options
3. **Permission Denied** (Mobile): Error toast with settings guidance
4. **Network Error**: Retry mechanism with error message

## Fallback Options

If contact syncing isn't available:
1. **Manual Entry**: Add contacts one by one via the Contacts page
2. **Mobile App**: Download iOS or Android app for full support
3. **Share Link**: Invite friends via WhatsApp/SMS sharing

## Testing

### Test Web Contact Picker:
1. Use Chrome browser on Android device
2. Ensure you're on HTTPS (required for Contact Picker API)
3. Test with different numbers of contacts (1, 5, 50+)
4. Test cancellation scenario

### Test Mobile App:
1. Build and run on physical device or emulator
2. Test permission flow
3. Test with large contact lists (500+)
4. Test permission denial and retry

## Future Enhancements

Potential improvements:
1. CSV/vCard import for desktop users
2. Contact sync via QR code
3. Group contact import
4. Automatic periodic sync
5. Contact deduplication
6. Contact merge suggestions
