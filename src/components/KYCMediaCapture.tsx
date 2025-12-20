import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, Upload, FolderOpen, Check, X, AlertCircle, 
  Loader2, RefreshCw, Image as ImageIcon, LucideIcon 
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { DirectCamera } from './DirectCamera';

export interface KYCUploadState {
  status: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error' | 'stalled';
  progress: number;
  url: string | null;
  error: string | null;
  file: File | null;
}

interface KYCMediaCaptureProps {
  type: 'id' | 'selfie' | 'proofOfAddress' | 'sourceOfFunds';
  uploadState: KYCUploadState;
  onFileSelect: (file: File) => void;
  onRetry: () => void;
  onCancel: () => void;
  accept?: string;
  label?: string;
  icon?: LucideIcon;
}

export const KYCMediaCapture: React.FC<KYCMediaCaptureProps> = ({
  type,
  uploadState,
  onFileSelect,
  onRetry,
  onCancel,
  accept = 'image/*,.pdf',
  label,
  icon: Icon = Camera,
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNative = Capacitor.isNativePlatform();

  // Determine if this type uses camera or file picker
  const usesCameraByDefault = type === 'id' || type === 'selfie';
  const cameraFacing = type === 'selfie' ? 'user' : 'environment';

  // Get labels based on type
  const getLabel = () => {
    if (label) return label;
    switch (type) {
      case 'id': return 'Take Photo of ID';
      case 'selfie': return 'Take Selfie';
      case 'proofOfAddress': return 'Upload Proof of Address';
      case 'sourceOfFunds': return 'Upload Supporting Document';
      default: return 'Upload File';
    }
  };

  const getGuideLabel = () => {
    switch (type) {
      case 'id': return 'Align your ID document in the frame';
      case 'selfie': return 'Position your face in the frame';
      default: return 'Take a clear photo';
    }
  };

  // Handle camera capture (direct getUserMedia for web)
  const handleCameraCapture = useCallback(async () => {
    console.log(`[KYCMediaCapture] ${type} - Camera capture requested, isNative:`, isNative);

    if (isNative) {
      // Use Capacitor Camera for native apps
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          direction: type === 'selfie' ? 'front' as any : 'rear' as any,
        });

        if (image.webPath) {
          const response = await fetch(image.webPath);
          const blob = await response.blob();
          const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
          console.log(`[KYCMediaCapture] ${type} - Native camera captured file:`, file.size);
          onFileSelect(file);
        }
      } catch (err: any) {
        console.error(`[KYCMediaCapture] ${type} - Native camera error:`, err);
        if (err.message !== 'User cancelled photos app') {
          // Fall back to direct camera
          setShowCamera(true);
        }
      }
    } else {
      // Use direct getUserMedia camera for web
      setShowCamera(true);
    }
  }, [type, isNative, onFileSelect]);

  // Handle gallery/file selection
  const handleFileSelect = useCallback(async () => {
    console.log(`[KYCMediaCapture] ${type} - File selection requested`);

    if (isNative) {
      // Use Capacitor Camera for gallery on native
      try {
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });

        if (image.webPath) {
          const response = await fetch(image.webPath);
          const blob = await response.blob();
          const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
          console.log(`[KYCMediaCapture] ${type} - Native gallery selected file:`, file.size);
          onFileSelect(file);
        }
      } catch (err: any) {
        console.error(`[KYCMediaCapture] ${type} - Native gallery error:`, err);
      }
    } else {
      // Use file input for web
      fileInputRef.current?.click();
    }
  }, [type, isNative, onFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log(`[KYCMediaCapture] ${type} - File input selected:`, file.name, file.size);
      onFileSelect(file);
    }
    // Reset input for re-selection
    if (e.target) {
      e.target.value = '';
    }
  }, [type, onFileSelect]);

  // Handle blob from DirectCamera
  const handleCameraBlob = useCallback((blob: Blob) => {
    const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    console.log(`[KYCMediaCapture] ${type} - DirectCamera captured:`, file.size);
    setShowCamera(false);
    onFileSelect(file);
  }, [type, onFileSelect]);

  // Render upload status UI
  const renderStatus = () => {
    switch (uploadState.status) {
      case 'compressing':
        return (
          <div className="flex flex-col items-center gap-2 p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Compressing image...</span>
            <Progress value={uploadState.progress} className="w-full max-w-xs" />
          </div>
        );

      case 'uploading':
        return (
          <div className="flex flex-col items-center gap-2 p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Uploading... {uploadState.progress}%</span>
            <Progress value={uploadState.progress} className="w-full max-w-xs" />
            <Button variant="ghost" size="sm" onClick={onCancel} className="mt-2 text-xs text-muted-foreground">
              Cancel
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center gap-2 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-6 w-6" />
              <span className="font-medium">Upload Complete</span>
            </div>
            {uploadState.file && (
              <span className="text-xs text-muted-foreground">{uploadState.file.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2 text-xs">
              Replace
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center gap-2 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <span className="font-medium">Upload Failed</span>
            </div>
            <span className="text-xs text-muted-foreground text-center">
              {uploadState.error || 'An error occurred'}
            </span>
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 gap-1">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        );

      case 'stalled':
        return (
          <div className="flex flex-col items-center gap-2 p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-6 w-6" />
              <span className="font-medium">Upload Stalled</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Network may be slow. Tap to retry.
            </span>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        );

      default: // idle
        return (
          <div className="flex flex-col gap-3 p-4">
            {usesCameraByDefault ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 h-12"
                  onClick={handleCameraCapture}
                >
                  <Camera className="h-5 w-5" />
                  {getLabel()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={handleFileSelect}
                >
                  <ImageIcon className="h-4 w-4" />
                  Choose from Gallery
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 h-12"
                  onClick={handleFileSelect}
                >
                  <Icon className="h-5 w-5" />
                  {getLabel()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={handleCameraCapture}
                >
                  <Camera className="h-4 w-4" />
                  Take Photo Instead
                </Button>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <>
      {/* Hidden file input for web */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Main capture UI */}
      <div className="border border-border rounded-lg bg-card">
        {renderStatus()}
      </div>

      {/* Direct Camera Modal */}
      {showCamera && (
        <DirectCamera
          onCapture={handleCameraBlob}
          onClose={() => setShowCamera(false)}
          facing={cameraFacing}
          guideLabel={getGuideLabel()}
          guideType={type === 'selfie' ? 'selfie' : 'id'}
        />
      )}
    </>
  );
};

export default KYCMediaCapture;
