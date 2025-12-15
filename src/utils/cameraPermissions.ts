/**
 * Camera Permission Utilities
 * Handles progressive camera permission requests for mobile KYC verification
 */

/**
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

/**
 * Request camera permission before opening file picker
 * This prevents iOS Safari from silently failing when camera access is needed
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    // Check if mediaDevices is available (HTTPS required)
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('[Camera] getUserMedia not available, proceeding without permission check');
      return true; // Allow to proceed - older browsers will use file input directly
    }
    
    // Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    // Immediately stop the stream - we just needed to trigger the permission prompt
    stream.getTracks().forEach(track => track.stop());
    
    console.log('[Camera] Permission granted');
    return true;
  } catch (error: any) {
    console.error('[Camera] Permission error:', error);
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return false; // User denied
    }
    
    // Other errors (NotFoundError for no camera, etc.) - allow to proceed with file input
    // This handles desktop browsers without cameras
    return true;
  }
};

/**
 * Request front camera permission (for selfies)
 */
export const requestFrontCameraPermission = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('[Camera] getUserMedia not available for front camera');
      return true;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' } 
    });
    
    stream.getTracks().forEach(track => track.stop());
    
    console.log('[Camera] Front camera permission granted');
    return true;
  } catch (error: any) {
    console.error('[Camera] Front camera permission error:', error);
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return false;
    }
    
    return true;
  }
};

/**
 * Check camera permission status without prompting
 */
export const checkCameraPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    if (!navigator.permissions?.query) {
      return 'prompt'; // Can't check, assume needs prompting
    }
    
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch {
    return 'prompt'; // API not supported
  }
};

/**
 * Get user-friendly error message for camera permission denial
 */
export const getCameraPermissionErrorMessage = (): string => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    return "Camera access denied. Please go to Settings > Safari > Camera and allow access, then try again.";
  }
  
  return "Camera access denied. Please allow camera access in your browser settings and try again.";
};
