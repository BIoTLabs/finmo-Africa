/**
 * Unified Mobile File Upload Hook
 * 
 * Provides reliable file upload across all platforms:
 * - Native apps (Capacitor): Uses Camera plugin
 * - Web browsers: Uses file input with 4 fallback mechanisms
 * 
 * Fallback mechanisms for Android Chrome (where onChange is unreliable):
 * 1. React onChange (primary)
 * 2. Native addEventListener change/input (secondary)
 * 3. window.focus + pageshow event (tertiary)
 * 4. Polling interval (quaternary)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface UseMobileFileUploadOptions {
  onCapture: (file: File) => void;
  accept?: string;
  type: string; // For logging purposes
}

export interface UseMobileFileUploadReturn {
  inputRef: React.RefObject<HTMLInputElement>;
  setInputRef: (node: HTMLInputElement | null) => void;
  triggerCapture: () => Promise<void>;
  triggerGallery: () => Promise<void>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isNative: boolean;
  isAwaiting: boolean;
  setAwaiting: (value: boolean) => void;
}

export function useMobileFileUpload({ 
  onCapture, 
  accept = 'image/*',
  type 
}: UseMobileFileUploadOptions): UseMobileFileUploadReturn {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAwaiting, setIsAwaiting] = useState(false);
  const [inputMounted, setInputMounted] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const mountedRef = useRef(true);
  const onCaptureRef = useRef(onCapture);
  
  // Keep onCapture ref updated to avoid stale closures
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Callback ref to detect when input is mounted in DOM
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    setInputMounted(!!node);
    if (node) {
      console.log(`[${type}] Input element mounted in DOM`);
    }
  }, [type]);

  // Process file and reset state
  const processFile = useCallback((file: File, source: string) => {
    console.log(`[${type}] ${source} - file detected:`, file.name, file.size);
    if (mountedRef.current) {
      onCaptureRef.current(file);
      setIsAwaiting(false);
    }
  }, [type]);

  // Native event listener fallback for browsers - only attach when input is mounted
  useEffect(() => {
    if (isNative || !inputMounted) return;
    
    const input = inputRef.current;
    if (!input) {
      console.log(`[${type}] Input ref is null despite inputMounted=true`);
      return;
    }

    const handleNativeEvent = (e: Event) => {
      console.log(`[${type}] Native ${e.type} event fired`);
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (file) {
        processFile(file, `Native ${e.type} event`);
        target.value = '';
      }
    };

    // Attach both change and input event listeners
    input.addEventListener('change', handleNativeEvent);
    input.addEventListener('input', handleNativeEvent);
    
    console.log(`[${type}] Native event listeners attached to mounted input`);

    return () => {
      input.removeEventListener('change', handleNativeEvent);
      input.removeEventListener('input', handleNativeEvent);
      console.log(`[${type}] Native event listeners removed`);
    };
  }, [isNative, inputMounted, type, processFile]);

  // Window focus/pageshow fallback for Android Chrome
  useEffect(() => {
    if (isNative || !isAwaiting) return;

    const handleFocus = () => {
      console.log(`[${type}] Window focus/pageshow, checking for file...`);
      
      if (inputRef.current?.files?.length) {
        const file = inputRef.current.files[0];
        processFile(file, 'Focus fallback');
        inputRef.current.value = '';
      } else {
        // User cancelled - reset after short delay
        setTimeout(() => {
          if (mountedRef.current && isAwaiting) {
            console.log(`[${type}] No file found after focus, resetting`);
            setIsAwaiting(false);
          }
        }, 500);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [isNative, isAwaiting, type, processFile]);

  // Polling fallback - check for files every 500ms when awaiting
  useEffect(() => {
    if (isNative || !isAwaiting) return;

    console.log(`[${type}] Starting polling fallback`);
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total

    const interval = setInterval(() => {
      attempts++;
      
      if (inputRef.current?.files?.length) {
        const file = inputRef.current.files[0];
        console.log(`[${type}] Polling found file at attempt ${attempts}`);
        processFile(file, 'Polling fallback');
        inputRef.current.value = '';
        clearInterval(interval);
        return;
      }

      if (attempts >= maxAttempts) {
        console.log(`[${type}] Polling timeout after ${maxAttempts} attempts`);
        setIsAwaiting(false);
        clearInterval(interval);
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isNative, isAwaiting, type, processFile]);

  // Trigger camera capture (native) or file input (browser)
  const triggerCapture = useCallback(async () => {
    console.log(`[${type}] triggerCapture called, isNative:`, isNative);
    
    if (isNative) {
      try {
        const image = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 80,
        });

        if (image.dataUrl) {
          const response = await fetch(image.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
          processFile(file, 'Capacitor Camera');
        }
      } catch (error: any) {
        console.error(`[${type}] Capacitor Camera error:`, error);
        if (error.message !== 'User cancelled photos app') {
          throw error;
        }
      }
    } else {
      // Browser: set awaiting and trigger file input
      setIsAwaiting(true);
      setTimeout(() => {
        if (inputRef.current) {
          console.log(`[${type}] Triggering file input click`);
          inputRef.current.click();
        }
      }, 0);
    }
  }, [isNative, type, processFile]);

  // Trigger gallery/file selection
  const triggerGallery = useCallback(async () => {
    console.log(`[${type}] triggerGallery called, isNative:`, isNative);
    
    if (isNative) {
      try {
        const image = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          quality: 80,
        });

        if (image.dataUrl) {
          const response = await fetch(image.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
          processFile(file, 'Capacitor Gallery');
        }
      } catch (error: any) {
        console.error(`[${type}] Capacitor Photos error:`, error);
        if (error.message !== 'User cancelled photos app') {
          throw error;
        }
      }
    } else {
      // Browser: same as capture but without capture attribute
      setIsAwaiting(true);
      setTimeout(() => {
        if (inputRef.current) {
          console.log(`[${type}] Triggering file input click for gallery`);
          inputRef.current.click();
        }
      }, 0);
    }
  }, [isNative, type, processFile]);

  // React onChange handler (primary for browsers)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(`[${type}] React onChange fired, files:`, e.target.files?.length);
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, 'React onChange');
    }
    e.target.value = '';
  }, [type, processFile]);

  return {
    inputRef,
    setInputRef,
    triggerCapture,
    triggerGallery,
    handleChange,
    isNative,
    isAwaiting,
    setAwaiting: setIsAwaiting,
  };
}
