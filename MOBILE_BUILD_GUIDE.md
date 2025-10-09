# Mobile Build Guide - FinMo Africa

## Android Build Setup

### Prerequisites
1. Android Studio installed
2. Java JDK 17 or higher
3. Git installed

### Initial Setup (First Time Only)

After cloning the repository, follow these steps:

```bash
# 1. Install dependencies
npm install

# 2. Build the web app
npm run build

# 3. Add Android platform (if not already added)
npx cap add android

# 4. Make gradlew executable
chmod +x android/gradlew

# 5. Sync Capacitor
npx cap sync android
```

### Building the App

```bash
# Option 1: Open in Android Studio
npx cap open android

# Option 2: Build from command line
cd android
./gradlew assembleDebug

# Option 3: Run on device/emulator
npx cap run android
```

### Troubleshooting

#### "gradlew not found" Error
This happens when:
- The android folder wasn't committed to git
- Line endings were changed (Windows)
- File permissions were lost

**Solution:**
```bash
# Re-add Android platform
npx cap add android

# Make gradlew executable
chmod +x android/gradlew

# Commit to git
git add android/gradlew
git commit -m "fix: ensure gradlew is executable"
```

#### Line Ending Issues (Windows)
The `.gitattributes` file ensures `gradlew` always uses LF line endings.
If you still have issues:
```bash
# Convert line endings
dos2unix android/gradlew

# Or reinstall platform
rm -rf android
npx cap add android
```

### iOS Build Setup

```bash
# 1. Add iOS platform
npx cap add ios

# 2. Sync Capacitor
npx cap sync ios

# 3. Open in Xcode (macOS only)
npx cap open ios
```

## Important Notes

1. **Always run `npm run build` before syncing** - Capacitor needs the built web assets
2. **Commit the android/ios folders** - These should be in version control
3. **Keep gradlew executable** - Use `chmod +x android/gradlew` after cloning
4. **Line endings matter** - The `.gitattributes` file handles this automatically

## Environment Variables

The app uses the following environment variables from `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Make sure these are set before building.

## For CI/CD

In your CI/CD pipeline, ensure:
```yaml
- run: chmod +x android/gradlew
- run: npm run build
- run: npx cap sync android
- run: cd android && ./gradlew assembleRelease
```
