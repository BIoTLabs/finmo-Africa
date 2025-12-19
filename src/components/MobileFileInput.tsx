/**
 * Mobile File Input Component
 * 
 * A drop-in replacement for file inputs that works reliably across:
 * - iOS Safari
 * - Android Chrome
 * - Capacitor native apps
 * 
 * Uses the useMobileFileUpload hook for all fallback mechanisms.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Camera, FolderOpen, Loader2, CheckCircle2, XCircle, RefreshCw, AlertTriangle, X, LucideIcon } from 'lucide-react';
import { useMobileFileUpload } from '@/hooks/useMobileFileUpload';

// Upload state interface (matches KYCVerification)
export interface UploadState {
  status: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error' | 'stalled';
  progress: number;
  url: string | null;
  error: string | null;
  file: File | null;
  startedAt?: number;
  abortController?: AbortController;
}

interface MobileFileInputProps {
  type: string;
  accept?: string;
  uploadState: UploadState;
  onFileSelect: (file: File) => void;
  onRetry: () => void;
  onCancel: () => void;
  icon?: LucideIcon;
  idleLabel?: string;
  showGalleryOption?: boolean;
  galleryLabel?: string;
  cameraLabel?: string;
  /**
   * Controls the HTML capture attribute behavior:
   * - 'camera': capture="environment" - prompts rear camera (for ID documents)
   * - 'user': capture="user" - prompts front camera (for selfies)
   * - 'none': no capture attribute - shows file picker (for documents/PDFs)
   * Default: 'none' for maximum compatibility on Android
   */
  captureMode?: 'camera' | 'user' | 'none';
}

export function MobileFileInput({
  type,
  accept = 'image/*,.pdf,application/pdf',
  uploadState,
  onFileSelect,
  onRetry,
  onCancel,
  icon: Icon = Camera,
  idleLabel,
  showGalleryOption = true,
  galleryLabel = 'Choose from Gallery',
  cameraLabel = 'Take Photo Instead',
  captureMode = 'none', // Default to 'none' for maximum Android compatibility
}: MobileFileInputProps) {
  const {
    setInputRef,
    triggerCapture,
    triggerGallery,
    handleChange,
    isNative,
    isAwaiting,
    setAwaiting,
  } = useMobileFileUpload({
    onCapture: onFileSelect,
    accept,
    type,
  });

  const isInteractive = uploadState.status === 'idle' || 
                        uploadState.status === 'error' || 
                        uploadState.status === 'stalled';

  const defaultIdleLabel = isNative ? 'Tap to Take Photo' : 'Take Photo or Select File';

  // Determine capture attribute based on captureMode
  const getCaptureAttribute = (): 'environment' | 'user' | undefined => {
    switch (captureMode) {
      case 'camera':
        return 'environment';
      case 'user':
        return 'user';
      case 'none':
      default:
        return undefined; // No capture attribute - shows file picker
    }
  };

  // Get container classes based on upload state
  const getContainerClasses = () => {
    const base = 'relative flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors';
    
    switch (uploadState.status) {
      case 'complete':
        return `${base} border-green-500 bg-green-50 dark:bg-green-950/20`;
      case 'error':
        return `${base} border-destructive bg-destructive/10`;
      case 'stalled':
        return `${base} border-yellow-500 bg-yellow-950/20`;
      default:
        return `${base} hover:bg-accent`;
    }
  };

  return (
    <div className="space-y-2">
      {/* Main upload area */}
      <div className={getContainerClasses()}>
        {/* Status display */}
        <FileUploadStatus
          uploadState={uploadState}
          icon={Icon}
          idleLabel={idleLabel || defaultIdleLabel}
          onRetry={onRetry}
          onCancel={onCancel}
        />

        {/* Native: invisible button to trigger Capacitor camera */}
        {isNative && isInteractive && (
          <Button
            type="button"
            variant="outline"
            className="absolute inset-0 w-full h-full opacity-0"
            onClick={triggerCapture}
          />
        )}

        {/* Browser: transparent file input overlay */}
        {!isNative && (
          <input
            ref={setInputRef}
            type="file"
            accept={accept}
            capture={getCaptureAttribute()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: isInteractive ? 'pointer' : 'default',
              zIndex: 10,
              pointerEvents: isInteractive ? 'auto' : 'none',
            }}
            onClick={() => {
              console.log(`[${type}] Input clicked, setting isAwaiting=true, captureMode=${captureMode}`);
              setAwaiting(true);
            }}
            onChange={handleChange}
            onInput={handleChange as React.FormEventHandler<HTMLInputElement>}
          />
        )}
      </div>

      {/* Secondary action: Gallery picker for native */}
      {isNative && showGalleryOption && isInteractive && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={triggerGallery}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          {galleryLabel}
        </Button>
      )}

      {/* Alternative: Camera option when gallery is primary */}
      {isNative && !showGalleryOption && isInteractive && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={triggerCapture}
        >
          <Camera className="h-4 w-4 mr-2" />
          {cameraLabel}
        </Button>
      )}
    </div>
  );
}

// File upload status display component
interface FileUploadStatusProps {
  uploadState: UploadState;
  icon: LucideIcon;
  idleLabel: string;
  onRetry: () => void;
  onCancel: () => void;
}

function FileUploadStatus({
  uploadState,
  icon: Icon,
  idleLabel,
  onRetry,
  onCancel,
}: FileUploadStatusProps) {
  switch (uploadState.status) {
    case 'idle':
      return (
        <>
          <Icon className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{idleLabel}</span>
        </>
      );
      
    case 'compressing':
      return (
        <div className="flex flex-col items-center gap-2 w-full">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Compressing image...</span>
          <Progress value={uploadState.progress} className="w-full max-w-[200px]" />
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      );
      
    case 'uploading':
      return (
        <div className="flex flex-col items-center gap-2 w-full">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">
            Uploading... {uploadState.progress}%
          </span>
          <Progress value={uploadState.progress} className="w-full max-w-[200px]" />
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      );
      
    case 'complete':
      return (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <span className="text-sm text-green-600 font-medium">Upload complete!</span>
          {uploadState.file && (
            <span className="text-xs text-muted-foreground">{uploadState.file.name}</span>
          )}
        </div>
      );
      
    case 'error':
      return (
        <div className="flex flex-col items-center gap-2">
          <XCircle className="h-8 w-8 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            {uploadState.error || 'Upload failed'}
          </span>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Tap to retry
          </Button>
        </div>
      );
      
    case 'stalled':
      return (
        <div className="flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          <span className="text-sm text-yellow-600 font-medium">Upload stalled</span>
          <span className="text-xs text-muted-foreground">Connection may be slow</span>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      );
      
    default:
      return null;
  }
}

export default MobileFileInput;
