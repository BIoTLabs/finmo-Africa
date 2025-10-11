#!/bin/bash
set -e

echo "Setting up Android build..."

# Ensure gradlew files are executable
chmod +x android/gradlew 2>/dev/null || true
chmod +x gradlew 2>/dev/null || true

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the web app
echo "Building web app..."
npm run build

# Sync Capacitor
echo "Syncing Capacitor..."
npx cap sync android

# Build Android app
echo "Building Android APK..."
cd android
./gradlew assembleRelease

echo "Build complete! APK is in android/app/build/outputs/apk/release/"
