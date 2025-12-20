import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw, Loader2, Check } from 'lucide-react';

interface DirectCameraProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  facing?: 'environment' | 'user';
  guideLabel?: string;
  guideType?: 'id' | 'selfie';
  autoCapture?: boolean;
  threshold?: number;
}

const SHARPNESS_THRESHOLD = 35;
const ANALYSIS_INTERVAL = 300;

export const DirectCamera: React.FC<DirectCameraProps> = ({
  onCapture,
  onClose,
  facing = 'environment',
  guideLabel = 'Align document in frame',
  guideType = 'id',
  autoCapture = false,
  threshold = SHARPNESS_THRESHOLD,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<string>('Initializing camera...');
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start camera
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        console.log('[DirectCamera] Starting camera with facing:', facing);
        
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          streamRef.current = mediaStream;
          
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (mounted) {
              setIsLoading(false);
              setStatus(guideLabel);
              console.log('[DirectCamera] Video ready');
            }
          };
        }
      } catch (err: any) {
        console.error('[DirectCamera] Camera error:', err);
        if (mounted) {
          setIsLoading(false);
          if (err.name === 'NotAllowedError') {
            setError('Camera access denied. Please allow camera access and try again.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found on this device.');
          } else {
            setError(`Camera error: ${err.message || 'Unknown error'}`);
          }
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [facing, guideLabel]);

  // Auto-capture analysis loop
  useEffect(() => {
    if (!autoCapture || isCaptured || isLoading || error) return;

    const interval = setInterval(() => {
      analyzeFrame();
    }, ANALYSIS_INTERVAL);

    return () => clearInterval(interval);
  }, [autoCapture, isCaptured, isLoading, error]);

  const analyzeFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = 400;
      canvas.height = 300;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sharpness = calculateSharpness(imageData);

      if (sharpness > threshold) {
        handleCapture();
      } else if (sharpness > 15) {
        setStatus('Hold still...');
      } else {
        setStatus(guideLabel);
      }
    }
  }, [threshold, guideLabel]);

  const calculateSharpness = (imageData: ImageData): number => {
    const data = imageData.data;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 16) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += avg;
      count++;
    }

    const mean = sum / count;
    let variance = 0;

    for (let i = 0; i < data.length; i += 16) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      variance += Math.pow(avg - mean, 2);
    }

    return Math.sqrt(variance / count);
  };

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    console.log('[DirectCamera] Capturing photo...');
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Full resolution capture
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log('[DirectCamera] Photo captured, size:', (blob.size / 1024).toFixed(1), 'KB');
          setCapturedBlob(blob);
          setIsCaptured(true);
          setStatus('Photo captured!');

          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
        }
      },
      'image/jpeg',
      0.9
    );
  }, []);

  const handleRetake = useCallback(() => {
    setIsCaptured(false);
    setCapturedBlob(null);
    setStatus(guideLabel);
  }, [guideLabel]);

  const handleConfirm = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      // Stop camera before closing
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [capturedBlob, onCapture]);

  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    onClose();
  }, [onClose]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <div className="text-white text-center max-w-sm">
          <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Camera Error</h3>
          <p className="text-sm opacity-80 mb-6">{error}</p>
          <Button variant="outline" onClick={handleClose} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close camera"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Video feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <p>Starting camera...</p>
            </div>
          </div>
        )}

        {/* Guide overlay */}
        {!isLoading && !isCaptured && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Guide frame */}
            <div
              className={`border-2 border-primary rounded-xl ${
                guideType === 'selfie' 
                  ? 'w-[70%] aspect-[3/4] rounded-full' 
                  : 'w-[85%] aspect-[1.6/1]'
              }`}
              style={{
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              }}
            />
            {/* Status text */}
            <p className="mt-6 text-white text-lg font-semibold text-center px-4 drop-shadow-lg">
              {status}
            </p>
          </div>
        )}

        {/* Captured preview */}
        {isCaptured && capturedBlob && (
          <div className="absolute inset-0">
            <img
              src={URL.createObjectURL(capturedBlob)}
              alt="Captured"
              className={`w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Bottom controls */}
      <div className="bg-black/80 py-6 px-4 flex items-center justify-center gap-6">
        {!isCaptured ? (
          <button
            onClick={handleCapture}
            disabled={isLoading}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            aria-label="Take photo"
          >
            <div className="w-16 h-16 rounded-full border-4 border-black" />
          </button>
        ) : (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RotateCcw className="h-5 w-5" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={handleConfirm}
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Check className="h-5 w-5" />
              Use Photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default DirectCamera;
