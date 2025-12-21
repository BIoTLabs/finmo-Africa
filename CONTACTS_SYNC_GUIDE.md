# Contact Syncing Guide

## Important: Native Device Required

The contact syncing feature **only works on physical iOS/Android devices or emulators**. It cannot be tested in the web preview.

## Setup Instructions

### 1. Export Your Project
- Clone your repository locally:
  ```bash
  git clone <your-repo-url>
  cd <your-project>
  ```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Native Platforms

**For iOS:**
```bash
npx cap add ios
```

**For Android:**
```bash
npx cap add android
```

### 4. Configure Native Permissions

#### iOS Setup (Info.plist)
After adding iOS, edit `ios/App/App/Info.plist` and add:
```xml
<key>NSContactsUsageDescription</key>
<string>We need access to your contacts to help you find friends who are using FinMo and make instant transfers</string>
```

#### Android Setup (AndroidManifest.xml)
The Android permissions are already configured in `capacitor.config.ts`, but verify they appear in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.WRITE_CONTACTS" />
```

### 5. Build and Sync
```bash
npm run build
npx cap sync
```

### 6. Run on Device/Emulator

**For iOS:**
```bash
npx cap open ios
```
Then run from Xcode on a simulator or connected device.

**For Android:**
```bash
npx cap open android
```
Then run from Android Studio on an emulator or connected device.

## Testing the Feature

1. Open the app on your device/emulator
2. Navigate to Profile → Contacts tab
3. Click "Sync Now" button
4. **You should see a native permission prompt**
5. Grant permission
6. Your contacts will be synced

## Troubleshooting

### "Contacts permission denied" without prompt
- Make sure you added the permission descriptions (see step 4)
- Run `npx cap sync` after adding permissions
- Clean and rebuild the native project

### Permission prompt not appearing
- Check that `NSContactsUsageDescription` is in Info.plist (iOS)
- Check that permissions are in AndroidManifest.xml (Android)
- Try uninstalling and reinstalling the app

### Still not working?
- Check console logs for detailed error messages
- Ensure you're running on a real device or emulator, not web preview
- Verify Capacitor version compatibility: `npx cap doctor`

## Additional Resources
- [Capacitor Contacts Plugin](https://github.com/capacitor-community/contacts)
