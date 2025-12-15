/**
 * Hybrid Camera Hook
 * Uses Capacitor Camera plugin for native apps, falls back to file input for browsers
 * Includes window.focus fallback for Android Chrome where onChange may not fire
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type CameraFacing = 'environment' | 'user';

interface UseHybridCameraOptions {
  onCapture: (file: File) => void;
  facing?: CameraFacing;
}

export function useHybridCamera({ onCapture, facing = 'environment' }: UseHybridCameraOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [awaitingFile, setAwaitingFile] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  
  console.log('[useHybridCamera] Platform:', isNative ? 'native' : 'browser');

  // Window focus fallback for Android Chrome
  // When file picker closes, window regains focus - check if file was selected
  useEffect(() => {
    if (isNative) return; // Not needed for native app
    
    const handleFocus = () => {
      console.log('[useHybridCamera] Window focus, awaitingFile:', awaitingFile);
      
      if (awaitingFile && inputRef.current?.files?.length) {
        const file = inputRef.current.files[0];
        console.log('[useHybridCamera] Focus fallback - file found:', file.name, file.size);
        onCapture(file);
        inputRef.current.value = '';
        setAwaitingFile(false);
      } else if (awaitingFile) {
        // User cancelled or no file - reset after short delay
        setTimeout(() => {
          if (awaitingFile) {
            console.log('[useHybridCamera] No file selected, resetting awaiting state');
            setAwaitingFile(false);
          }
        }, 500);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [awaitingFile, onCapture, isNative]);

  // Native event listener fallback for browsers
  useEffect(() => {
    if (isNative) return;
    
    const input = inputRef.current;
    if (!input) return;

    const handleNativeChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      console.log('[useHybridCamera] Native change event, file:', file?.name);
      
      if (file) {
        onCapture(file);
        target.value = '';
        setAwaitingFile(false);
      }
    };

    input.addEventListener('change', handleNativeChange);
    return () => input.removeEventListener('change', handleNativeChange);
  }, [onCapture, isNative]);

  // Capture photo using appropriate method
  const capturePhoto = useCallback(async () => {
    console.log('[useHybridCamera] capturePhoto called, isNative:', isNative);
    
    if (isNative) {
      // Use Capacitor Camera plugin for native app
      try {
        console.log('[useHybridCamera] Using Capacitor Camera plugin');
        const image = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 80,
          direction: facing === 'user' ? undefined : undefined, // Direction is handled by source
        });

        if (image.dataUrl) {
          console.log('[useHybridCamera] Got image dataUrl, converting to File');
          // Convert dataUrl to File
          const response = await fetch(image.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          console.log('[useHybridCamera] File created:', file.name, file.size);
          onCapture(file);
        }
      } catch (error: any) {
        console.error('[useHybridCamera] Capacitor Camera error:', error);
        // User cancelled or error - no action needed
        if (error.message !== 'User cancelled photos app') {
          throw error;
        }
      }
    } else {
      // Use file input for browser
      console.log('[useHybridCamera] Using file input for browser');
      setAwaitingFile(true);
      
      // Small delay to ensure state is set before click
      setTimeout(() => {
        if (inputRef.current) {
          console.log('[useHybridCamera] Triggering file input click');
          inputRef.current.click();
        }
      }, 0);
    }
  }, [isNative, onCapture, facing]);

  // Select file from gallery/files
  const selectFile = useCallback(async () => {
    console.log('[useHybridCamera] selectFile called, isNative:', isNative);
    
    if (isNative) {
      // Use Capacitor Camera plugin with photos source
      try {
        console.log('[useHybridCamera] Using Capacitor Camera for photo selection');
        const image = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          quality: 80,
        });

        if (image.dataUrl) {
          console.log('[useHybridCamera] Got image from gallery, converting to File');
          const response = await fetch(image.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          console.log('[useHybridCamera] File created:', file.name, file.size);
          onCapture(file);
        }
      } catch (error: any) {
        console.error('[useHybridCamera] Capacitor Photos error:', error);
        if (error.message !== 'User cancelled photos app') {
          throw error;
        }
      }
    } else {
      // Use file input for browser - same as capturePhoto but without capture attribute
      console.log('[useHybridCamera] Using file input for file selection');
      setAwaitingFile(true);
      
      setTimeout(() => {
        if (inputRef.current) {
          // Remove capture attribute for file picker
          inputRef.current.removeAttribute('capture');
          console.log('[useHybridCamera] Triggering file input click for file selection');
          inputRef.current.click();
        }
      }, 0);
    }
  }, [isNative, onCapture]);

  // Handle change event from file input (React onChange)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[useHybridCamera] React onChange fired, files:', e.target.files?.length);
    const file = e.target.files?.[0];
    if (file) {
      console.log('[useHybridCamera] Processing file from onChange:', file.name, file.size);
      onCapture(file);
      setAwaitingFile(false);
    }
    e.target.value = '';
  }, [onCapture]);

  return {
    inputRef,
    capturePhoto,
    selectFile,
    handleInputChange,
    isNative,
    awaitingFile,
  };
}
