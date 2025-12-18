import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight,
  Shield, AlertTriangle, Camera, FileText, MapPin, Briefcase,
  DollarSign, User, Info, Loader2, RefreshCw, FolderOpen
} from "lucide-react";
import { useRewardTracking } from "@/hooks/useRewardTracking";
import { useKYCTiers, useCountryKYCRequirements, useUserKYCTier, getTierDisplayName, getTierColor, type KYCTier, type CountryKYCRequirement } from "@/hooks/useKYCTiers";
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

// Upload state interface for immediate file uploads
interface UploadState {
  status: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error' | 'stalled';
  progress: number;
  url: string | null;
  error: string | null;
  file: File | null;
  startedAt?: number; // Track when upload started for stall detection
  abortController?: AbortController; // Allow cancellation
}

const initialUploadState: UploadState = { 
  status: 'idle', progress: 0, url: null, error: null, file: null, startedAt: undefined, abortController: undefined 
};

// Constants for upload behavior
const STALL_DETECTION_MS = 20000; // 20 seconds without progress = stalled
const UPLOAD_TIMEOUT_MS = 120000; // 2 minutes max for full upload
const PROGRESS_CHECK_INTERVAL_MS = 5000; // Check for stall every 5 seconds

const ID_TYPES: Record<string, { value: string; label: string }[]> = {
  NG: [
    { value: 'nin_slip', label: 'NIN Slip' },
    { value: 'voters_card', label: "Voter's Card" },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'international_passport', label: 'International Passport' },
  ],
  ZA: [
    { value: 'sa_id_card', label: 'SA ID Card' },
    { value: 'sa_id_book', label: 'SA ID Book' },
    { value: 'passport', label: 'Passport' },
  ],
  KE: [
    { value: 'national_id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
  ],
  GH: [
    { value: 'ghana_card', label: 'Ghana Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'voters_id', label: "Voter's ID" },
    { value: 'drivers_license', label: "Driver's License" },
  ],
  UG: [
    { value: 'national_id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
    { value: 'drivers_license', label: "Driver's License" },
  ],
  TZ: [
    { value: 'nida_id', label: 'NIDA National ID' },
    { value: 'passport', label: 'Passport' },
    { value: 'voters_id', label: "Voter's ID" },
  ],
  DEFAULT: [
    { value: 'passport', label: 'Passport' },
    { value: 'national_id', label: 'National ID' },
    { value: 'drivers_license', label: "Driver's License" },
  ],
};

const TAX_ID_LABELS: Record<string, string> = {
  NG: 'BVN (Bank Verification Number)',
  ZA: 'Tax Number',
  KE: 'KRA PIN',
  GH: 'TIN (Tax Identification Number)',
  UG: 'TIN (Tax Identification Number)',
  TZ: 'TIN (Tax Identification Number)',
  DEFAULT: 'Tax ID',
};

const SOURCE_OF_FUNDS_OPTIONS = [
  'Employment / Salary',
  'Business Income',
  'Investments',
  'Inheritance',
  'Savings',
  'Pension / Retirement',
  'Gift',
  'Other',
];

// Valid ID types that match the database constraint
const VALID_ID_TYPES = [
  'passport', 'national_id', 'drivers_license', 'voters_card',
  'nin_slip', 'international_passport', 'bvn',
  'sa_id_card', 'sa_id_book',
  'ghana_card', 'voters_id',
  'kenya_id', 'kra_pin',
  'nida_id', 'uganda_id'
];

// Parse constraint violation errors for user-friendly messages
const parseKYCError = (error: any): string => {
  const message = error?.message || '';
  
  if (message.includes('kyc_verifications_id_type_check')) {
    return 'Invalid ID type selected. Please select a valid document type for your country.';
  }
  if (message.includes('duplicate key')) {
    return 'You already have a pending verification. Please wait for it to be reviewed.';
  }
  if (message.includes('violates check constraint')) {
    return 'One of the submitted values is invalid. Please review your information.';
  }
  if (message.includes('timed out')) {
    return 'The operation took too long. Please try again.';
  }
  
  return message || 'An unexpected error occurred. Please try again.';
};

export default function KYCVerification() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [targetTier, setTargetTier] = useState<string>('tier_1');
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    address: "",
    country_code: "",
    id_type: "",
    id_number: "",
    tax_id: "",
    tax_id_type: "",
    source_of_funds: "",
    occupation: "",
    employer_name: "",
  });
  // Immediate upload states - files upload as soon as selected
  const [idDocumentUpload, setIdDocumentUpload] = useState<UploadState>(initialUploadState);
  const [selfieUpload, setSelfieUpload] = useState<UploadState>(initialUploadState);
  const [proofOfAddressUpload, setProofOfAddressUpload] = useState<UploadState>(initialUploadState);
  const [sourceOfFundsUpload, setSourceOfFundsUpload] = useState<UploadState>(initialUploadState);
  
  // Track last progress update for stall detection
  const lastProgressRef = useRef<Record<string, { progress: number; timestamp: number }>>({});
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flag to indicate if this is an upgrade flow
  const [isUpgradeFlow, setIsUpgradeFlow] = useState(false);
  
  // Track when awaiting file selection for window.focus fallback
  const [awaitingFile, setAwaitingFile] = useState<string | null>(null);
  
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  
  // File input refs for reliable programmatic triggering
  const idDocInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const proofAddressInputRef = useRef<HTMLInputElement>(null);
  const sourceFundsInputRef = useRef<HTMLInputElement>(null);
  
  // Note: Callback ref pattern removed - using simpler direct overlay pattern like ID/Selfie uploads
  
  // Detect if running in native app
  const isNative = Capacitor.isNativePlatform();
  console.log('[KYC] Platform:', isNative ? 'native (Capacitor)' : 'browser');
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { trackActivity } = useRewardTracking();
  const { tiers, loading: tiersLoading } = useKYCTiers();
  const { requirements, loading: requirementsLoading } = useCountryKYCRequirements(userCountry);
  const { userTier, limits, loading: userTierLoading } = useUserKYCTier();

  useEffect(() => {
    mountedRef.current = true;
    checkKYCStatus();
    fetchUserCountry();
    // Pre-fetch user ID for uploads
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id || null;
    });
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchUserCountry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single();

      if (profile?.phone_number) {
        // Extract country from phone number
        let countryCode = 'DEFAULT';
        if (profile.phone_number.startsWith('+234')) countryCode = 'NG';
        else if (profile.phone_number.startsWith('+27')) countryCode = 'ZA';
        else if (profile.phone_number.startsWith('+254')) countryCode = 'KE';
        else if (profile.phone_number.startsWith('+233')) countryCode = 'GH';
        else if (profile.phone_number.startsWith('+256')) countryCode = 'UG';
        else if (profile.phone_number.startsWith('+255')) countryCode = 'TZ';

        setUserCountry(countryCode);
        setFormData(prev => ({
          ...prev,
          country_code: countryCode !== 'DEFAULT' ? countryCode : '',
        }));
      }
    } catch (error) {
      console.error('Error fetching user country:', error);
    }
  };

  const checkKYCStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setKycStatus(data);
    } catch (error: any) {
      console.error("Error checking KYC status:", error);
    }
  };

  const currentTierConfig = useMemo(() => {
    return tiers.find(t => t.tier === targetTier);
  }, [tiers, targetTier]);

  const currentRequirements = useMemo(() => {
    return requirements.find(r => r.tier === targetTier);
  }, [requirements, targetTier]);

  const availableIdTypes = useMemo(() => {
    return ID_TYPES[formData.country_code] || ID_TYPES.DEFAULT;
  }, [formData.country_code]);

  const taxIdLabel = useMemo(() => {
    return TAX_ID_LABELS[formData.country_code] || TAX_ID_LABELS.DEFAULT;
  }, [formData.country_code]);

  // Utility function to wrap promises with timeout
  const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  };

  // Detect mobile device for more aggressive compression
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Detect slow connection to skip compression entirely
  const isSlowConnection = (): boolean => {
    const connection = (navigator as any).connection;
    if (!connection) return false;
    return connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g';
  };

  // Compress image for mobile - reduces file size significantly
  // Uses FileReader for iOS compatibility and includes safety timeout
  const compressImage = useCallback(async (file: File, maxSizeKB?: number): Promise<File> => {
    console.log(`[Compression] Starting for ${file.name}, size: ${(file.size / 1024).toFixed(1)}KB, type: ${file.type}`);
    
    // Skip compression for non-image files
    if (!file.type.startsWith('image/')) {
      console.log('[Compression] Not an image, skipping');
      return file;
    }

    // Skip HEIC files - they don't compress well in browsers
    const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    if (isHEIC) {
      console.log('[Compression] HEIC format detected, skipping compression');
      return file;
    }

    // Skip compression entirely on very slow connections
    if (isSlowConnection()) {
      console.log('[Compression] Slow connection detected, skipping');
      return file;
    }

    // Use more aggressive settings on mobile
    const targetSizeKB = maxSizeKB ?? (isMobile ? 300 : 500);
    const maxDimension = isMobile ? 1000 : 1200;

    // Skip if already small enough
    if (file.size <= targetSizeKB * 1024) {
      console.log(`[Compression] File already small enough: ${(file.size / 1024).toFixed(1)}KB`);
      return file;
    }

    // Safety timeout - if compression hangs, return original file
    const TIMEOUT_MS = isMobile ? 12000 : 20000;
    
    const compressionPromise = new Promise<File>((resolve) => {
      // Use FileReader instead of URL.createObjectURL for better iOS compatibility
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('[Compression] FileReader loaded successfully');
        const img = new Image();
        
        img.onload = () => {
          console.log(`[Compression] Image loaded: ${img.width}x${img.height}`);
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              console.warn('[Compression] No canvas context, using original');
              resolve(file);
              return;
            }

            // Calculate new dimensions
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
              } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Single compression attempt with fixed quality for speed
            const quality = isMobile ? 0.65 : 0.75;
            
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  console.warn('[Compression] toBlob returned null, using original');
                  resolve(file);
                  return;
                }

                console.log(`[Compression] Success: ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB`);
                
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              },
              'image/jpeg',
              quality
            );
          } catch (err) {
            console.warn('[Compression] Canvas error, using original:', err);
            resolve(file);
          }
        };

        img.onerror = () => {
          console.warn('[Compression] Image load failed, using original');
          resolve(file);
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        console.warn('[Compression] FileReader error, using original');
        resolve(file);
      };

      reader.readAsDataURL(file);
    });

    // Race between compression and timeout
    const timeoutPromise = new Promise<File>((resolve) => {
      setTimeout(() => {
        console.warn(`[Compression] Timeout after ${TIMEOUT_MS}ms, using original file`);
        resolve(file);
      }, TIMEOUT_MS);
    });

    try {
      return await Promise.race([compressionPromise, timeoutPromise]);
    } catch {
      console.warn('[Compression] Unexpected error, using original');
      return file;
    }
  }, [isMobile]);

  // Cancel an in-progress upload
  const cancelUpload = useCallback((
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>,
    uploadState: UploadState
  ) => {
    if (uploadState.abortController) {
      uploadState.abortController.abort();
    }
    setUploadState(initialUploadState);
  }, []);

  // XHR-based upload with real progress tracking
const uploadWithProgress = useCallback(async (
    file: File,
    filePath: string,
    type: string,
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>,
    abortController: AbortController,
    accessToken: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track progress for stall detection
      lastProgressRef.current[type] = { progress: 0, timestamp: Date.now() };
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          // Scale to 30-95 range (leaving room for compression at start, finalization at end)
          const scaledProgress = 30 + Math.round((percentComplete / 100) * 65);
          
          // Update stall detection tracker
          lastProgressRef.current[type] = { progress: scaledProgress, timestamp: Date.now() };
          
          if (mountedRef.current) {
            setUploadState(prev => ({ ...prev, progress: scaledProgress }));
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(filePath);
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || errorData.error || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      
      // Handle abort
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      });

      // Get Supabase storage URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/kyc-documents/${filePath}`;

      xhr.open('POST', uploadUrl, true);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('x-upsert', 'true');
      
      xhr.send(file);
    });
  }, []);


  // Immediate file upload handler - called when user selects a file
  const handleFileSelect = useCallback(async (
    file: File, 
    type: 'id' | 'selfie' | 'proofOfAddress' | 'sourceOfFunds',
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>
  ) => {
    console.log(`[${type}] File selected:`, file.name, `${(file.size / 1024).toFixed(1)}KB`, file.type);
    
    // Get user ID and access token
    let userId = userIdRef.current;
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id || null;
      userIdRef.current = userId;
    }

    // Get fresh access token for upload (required for RLS)
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    if (!userId || !accessToken) {
      console.error(`[${type}] No user ID or access token found`);
      setUploadState({ status: 'error', progress: 0, url: null, error: 'Not authenticated', file });
      return;
    }

    const abortController = new AbortController();

    // Start compressing
    setUploadState({ 
      status: 'compressing', 
      progress: 10, 
      url: null, 
      error: null, 
      file,
      startedAt: Date.now(),
      abortController 
    });
    console.log(`[${type}] Starting compression...`);

    try {
      // Compress the image (with timeout protection)
      const compressed = await compressImage(file);
      console.log(`[${type}] Compression done, size: ${(compressed.size / 1024).toFixed(1)}KB`);
      
      if (!mountedRef.current || abortController.signal.aborted) {
        console.log(`[${type}] Component unmounted or cancelled, aborting`);
        return;
      }
      
      // Start uploading
      setUploadState(prev => ({ 
        ...prev, 
        status: 'uploading', 
        progress: 30 
      }));
      console.log(`[${type}] Starting upload with real progress...`);

      // Generate file path
      const fileExt = compressed.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'jpg';
      const folder = type === 'id' ? 'id-documents' : type === 'selfie' ? 'selfies' : type === 'proofOfAddress' ? 'proof-of-address' : 'source-of-funds';
      const fileName = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

      // Upload with XHR for real progress
      await uploadWithProgress(compressed, fileName, type, setUploadState, abortController, accessToken);

      if (!mountedRef.current || abortController.signal.aborted) {
        console.log(`[${type}] Component unmounted or cancelled after upload`);
        return;
      }

      // Success!
      const url = `kyc-documents/${fileName}`;
      console.log(`[${type}] Upload complete! URL:`, url);
      setUploadState({ status: 'complete', progress: 100, url, error: null, file });
      
      // Clean up stall tracker
      delete lastProgressRef.current[type];
      
    } catch (err: any) {
      console.error(`[${type}] Error:`, err);
      // Clean up stall tracker
      delete lastProgressRef.current[type];
      
      if (mountedRef.current && !abortController.signal.aborted) {
        setUploadState({ 
          status: 'error', 
          progress: 0, 
          url: null, 
          error: err.message || 'Upload failed. Tap to retry.', 
          file 
        });
      }
    }
  }, [compressImage, uploadWithProgress]);

  // Reset upload state for retry
  const resetUpload = useCallback((setUploadState: React.Dispatch<React.SetStateAction<UploadState>>) => {
    setUploadState(initialUploadState);
  }, []);

  // Note: Callback ref handlers removed - using simpler direct overlay pattern like ID/Selfie uploads

  // Window focus fallback for Android Chrome - check for file selection when window regains focus
  useEffect(() => {
    if (isNative) return; // Not needed for native app

    const handleFocus = () => {
      if (!awaitingFile) return;
      
      console.log('[KYC] Window focus event, awaitingFile:', awaitingFile);
      
      // Check each ref based on which one we're waiting for
      const checkRef = (ref: React.RefObject<HTMLInputElement | null>, type: string) => {
        if (awaitingFile === type && ref.current?.files?.length) {
          const file = ref.current.files[0];
          console.log(`[KYC] Focus fallback - ${type} file found:`, file.name, file.size);
          
          if (type === 'id') handleFileSelect(file, 'id', setIdDocumentUpload);
          else if (type === 'selfie') handleFileSelect(file, 'selfie', setSelfieUpload);
          else if (type === 'proofOfAddress') handleFileSelect(file, 'proofOfAddress', setProofOfAddressUpload);
          else if (type === 'sourceOfFunds') handleFileSelect(file, 'sourceOfFunds', setSourceOfFundsUpload);
          
          ref.current.value = '';
          setAwaitingFile(null);
          return true;
        }
        return false;
      };

      const found = 
        checkRef(idDocInputRef, 'id') ||
        checkRef(selfieInputRef, 'selfie') ||
        checkRef(proofAddressInputRef, 'proofOfAddress') ||
        checkRef(sourceFundsInputRef, 'sourceOfFunds');

      if (!found) {
        // User cancelled or no file - reset after short delay
        setTimeout(() => {
          console.log('[KYC] No file selected after focus, resetting awaiting state');
          setAwaitingFile(null);
        }, 500);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus); // Android returns from picker fires pageshow
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [awaitingFile, isNative, handleFileSelect]);

  // Native addEventListener fallback for Android - attach native change/input listeners
  // CRITICAL: currentStep in dependency array ensures listeners attach when inputs render
  useEffect(() => {
    if (isNative) return; // Not needed for native app

    // Note: sourceFundsInputRef and proofAddressInputRef use callback ref pattern, so exclude from this useEffect
    const inputConfigs = [
      { ref: idDocInputRef, type: 'id' as const, setState: setIdDocumentUpload },
      { ref: selfieInputRef, type: 'selfie' as const, setState: setSelfieUpload },
      // proofAddressInputRef now uses callback ref pattern
    ];

    // Log which inputs are available on this step
    console.log(`[KYC] Step ${currentStep} - Input availability:`, {
      id: !!idDocInputRef.current,
      selfie: !!selfieInputRef.current,
      proofAddress: !!proofAddressInputRef.current,
      sourceFunds: !!sourceFundsInputRef.current,
    });

    const cleanupFns: Array<() => void> = [];

    inputConfigs.forEach(({ ref, type, setState }) => {
      const input = ref.current;
      if (!input) {
        console.log(`[${type}] Input ref not available yet (currentStep: ${currentStep})`);
        return;
      }

      const handleNativeEvent = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        console.log(`[${type}] Native ${e.type} event fired, file:`, file?.name, file?.size);
        
        if (file) {
          // Show toast feedback so user knows file was detected
          toast({
            title: "File Selected",
            description: `Processing ${file.name}...`,
          });
          handleFileSelect(file, type, setState);
          setAwaitingFile(null);
          target.value = '';
        }
      };

      // Listen to both 'change' and 'input' events as fallbacks
      input.addEventListener('change', handleNativeEvent);
      input.addEventListener('input', handleNativeEvent);
      
      console.log(`[${type}] Native event listeners attached successfully (step ${currentStep})`);

      cleanupFns.push(() => {
        input.removeEventListener('change', handleNativeEvent);
        input.removeEventListener('input', handleNativeEvent);
      });
    });

    return () => cleanupFns.forEach(fn => fn());
  }, [isNative, handleFileSelect, currentStep]); // Added currentStep to re-attach when step changes

  // Polling fallback for Android - check for files every 500ms when awaiting
  useEffect(() => {
    if (!awaitingFile || isNative) return;

    console.log(`[KYC] Starting polling for ${awaitingFile} (step ${currentStep})`);
    let attempts = 0;
    const maxAttempts = 20; // Check for 10 seconds (500ms * 20)

    const inputMap: Record<string, { ref: React.RefObject<HTMLInputElement | null>, setState: React.Dispatch<React.SetStateAction<UploadState>> }> = {
      'id': { ref: idDocInputRef, setState: setIdDocumentUpload },
      'selfie': { ref: selfieInputRef, setState: setSelfieUpload },
      'proofOfAddress': { ref: proofAddressInputRef, setState: setProofOfAddressUpload },
      'sourceOfFunds': { ref: sourceFundsInputRef, setState: setSourceOfFundsUpload },
    };

    const interval = setInterval(() => {
      attempts++;
      const config = inputMap[awaitingFile];
      
      if (config?.ref.current?.files?.length) {
        // CRITICAL: Store file reference BEFORE clearing input value
        const fileToUpload = config.ref.current.files[0];
        console.log(`[${awaitingFile}] Polling found file at attempt ${attempts}:`, fileToUpload.name, fileToUpload.size);
        
        // Show toast feedback
        toast({
          title: "File Selected",
          description: `Processing ${fileToUpload.name}...`,
        });
        
        // Process the stored file reference
        handleFileSelect(fileToUpload, awaitingFile as any, config.setState);
        
        // Clear input AFTER storing file reference
        config.ref.current.value = '';
        setAwaitingFile(null);
        clearInterval(interval);
        return;
      }

      if (attempts >= maxAttempts) {
        console.log(`[${awaitingFile}] Polling timeout after ${maxAttempts} attempts (step ${currentStep})`);
        setAwaitingFile(null);
        clearInterval(interval);
      }
    }, 500);

    return () => {
      console.log(`[KYC] Stopping polling for ${awaitingFile}`);
      clearInterval(interval);
    };
  }, [awaitingFile, isNative, handleFileSelect, currentStep]);

  // Native Capacitor Camera capture function
  const captureWithCapacitor = useCallback(async (
    type: 'id' | 'selfie' | 'proofOfAddress' | 'sourceOfFunds',
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>,
    source: CameraSource = CameraSource.Camera
  ) => {
    console.log(`[KYC] Capacitor camera capture for ${type}, source:`, source);
    try {
      const image = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: source,
        quality: 80,
      });

      if (image.dataUrl) {
        console.log(`[KYC] Got image dataUrl for ${type}, converting to File`);
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `${type}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        console.log(`[KYC] File created for ${type}:`, file.name, file.size);
        handleFileSelect(file, type, setUploadState);
      }
    } catch (error: any) {
      console.error(`[KYC] Capacitor Camera error for ${type}:`, error);
      if (error.message !== 'User cancelled photos app') {
        toast({
          title: "Camera Error",
          description: error.message || "Failed to capture photo",
          variant: "destructive"
        });
      }
    }
  }, [handleFileSelect, toast]);

  // Trigger file input for browser (with awaiting state for window.focus fallback)
  const triggerFileInput = useCallback((
    ref: React.RefObject<HTMLInputElement | null>,
    type: 'id' | 'selfie' | 'proofOfAddress' | 'sourceOfFunds'
  ) => {
    console.log(`[KYC] Triggering file input for ${type}`);
    setAwaitingFile(type);
    setTimeout(() => {
      if (ref.current) {
        ref.current.click();
      }
    }, 0);
  }, []);

  
  // Stall detection - check if any uploads have stalled
  useEffect(() => {
    const checkForStalls = () => {
      const now = Date.now();
      
      const checkAndMarkStalled = (
        type: string, 
        uploadState: UploadState, 
        setUploadState: React.Dispatch<React.SetStateAction<UploadState>>
      ) => {
        if (uploadState.status !== 'uploading' && uploadState.status !== 'compressing') return;
        
        const lastProgress = lastProgressRef.current[type];
        if (lastProgress && (now - lastProgress.timestamp) > STALL_DETECTION_MS) {
          console.warn(`[${type}] Upload stalled - no progress for ${STALL_DETECTION_MS/1000}s`);
          setUploadState(prev => ({ ...prev, status: 'stalled' }));
        }
      };
      
      checkAndMarkStalled('id', idDocumentUpload, setIdDocumentUpload);
      checkAndMarkStalled('selfie', selfieUpload, setSelfieUpload);
      checkAndMarkStalled('proofOfAddress', proofOfAddressUpload, setProofOfAddressUpload);
      checkAndMarkStalled('sourceOfFunds', sourceOfFundsUpload, setSourceOfFundsUpload);
    };
    
    // Run stall check every 5 seconds
    stallCheckIntervalRef.current = setInterval(checkForStalls, PROGRESS_CHECK_INTERVAL_MS);
    
    return () => {
      if (stallCheckIntervalRef.current) {
        clearInterval(stallCheckIntervalRef.current);
      }
    };
  }, [idDocumentUpload, selfieUpload, proofOfAddressUpload, sourceOfFundsUpload]);

  // Check if all required uploads are complete
  const canSubmit = useMemo(() => {
    if (loading) return false;
    
    const idReady = idDocumentUpload.status === 'complete';
    const selfieReady = selfieUpload.status === 'complete';
    
    // Tier 2+ requires proof of address
    const proofReady = targetTier === 'tier_1' || proofOfAddressUpload.status === 'complete';
    
    // Tier 2+ requires source of funds document
    const sourceOfFundsReady = targetTier === 'tier_1' || sourceOfFundsUpload.status === 'complete';
    
    return idReady && selfieReady && proofReady && sourceOfFundsReady;
  }, [idDocumentUpload, selfieUpload, proofOfAddressUpload, sourceOfFundsUpload, targetTier, loading]);

  // Debug logging for upload state changes
  useEffect(() => {
    console.log('[Upload States]', {
      id: { status: idDocumentUpload.status, progress: idDocumentUpload.progress },
      selfie: { status: selfieUpload.status, progress: selfieUpload.progress },
      proof: { status: proofOfAddressUpload.status, progress: proofOfAddressUpload.progress },
      source: { status: sourceOfFundsUpload.status, progress: sourceOfFundsUpload.progress },
      targetTier,
      canSubmit
    });
  }, [idDocumentUpload, selfieUpload, proofOfAddressUpload, sourceOfFundsUpload, targetTier, canSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mountedRef.current) return;
    
    console.log('[handleSubmit] Attempting submission with upload states:', {
      id: idDocumentUpload.status,
      selfie: selfieUpload.status,
      proof: proofOfAddressUpload.status,
      source: sourceOfFundsUpload.status,
      targetTier
    });
    
    // Check for missing required documents (idle = never uploaded)
    if (idDocumentUpload.status === 'idle') {
      toast({ title: "Missing Document", description: "Please upload your ID document", variant: "destructive" });
      return;
    }
    if (selfieUpload.status === 'idle') {
      toast({ title: "Missing Document", description: "Please upload your selfie photo", variant: "destructive" });
      return;
    }
    if ((targetTier === 'tier_2' || targetTier === 'tier_3') && proofOfAddressUpload.status === 'idle') {
      toast({ title: "Missing Document", description: "Please upload your proof of address", variant: "destructive" });
      return;
    }
    if ((targetTier === 'tier_2' || targetTier === 'tier_3') && sourceOfFundsUpload.status === 'idle') {
      toast({ title: "Missing Document", description: "Please upload your supporting documentation (bank statement, pay slip, etc.)", variant: "destructive" });
      return;
    }
    
    // Verify all required uploads are complete (files already uploaded!)
    if (idDocumentUpload.status !== 'complete') {
      toast({ title: "Please wait", description: "ID document is still uploading", variant: "destructive" });
      return;
    }
    if (selfieUpload.status !== 'complete') {
      toast({ title: "Please wait", description: "Selfie is still uploading", variant: "destructive" });
      return;
    }
    if ((targetTier === 'tier_2' || targetTier === 'tier_3') && proofOfAddressUpload.status !== 'complete') {
      toast({ title: "Please wait", description: "Proof of address is still uploading", variant: "destructive" });
      return;
    }
    if ((targetTier === 'tier_2' || targetTier === 'tier_3') && sourceOfFundsUpload.status !== 'complete') {
      toast({ title: "Required Document Missing", description: "Source of funds document is required for Premium verification", variant: "destructive" });
      return;
    }

    setLoading(true);
    setLoadingStep("Saving verification...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate based on tier requirements
      if (targetTier === 'tier_2' || targetTier === 'tier_3') {
        if (!formData.tax_id) {
          throw new Error(`${taxIdLabel} is required for this verification tier`);
        }
      }

      if (targetTier === 'tier_3') {
        if (!formData.source_of_funds) {
          throw new Error("Source of funds is required for this verification tier");
        }
        if (!formData.occupation) {
          throw new Error("Occupation is required for this verification tier");
        }
      }

      // Validate ID type before submission
      if (!VALID_ID_TYPES.includes(formData.id_type)) {
        throw new Error(`Invalid ID type "${formData.id_type}". Please select a valid document type for your country.`);
      }

      // Just do the database insert - files already uploaded!
      const insertData: any = {
        user_id: user.id,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth,
        address: formData.address || '',
        country_code: formData.country_code,
        id_type: formData.id_type,
        id_number: formData.id_number,
        id_document_url: idDocumentUpload.url,
        selfie_url: selfieUpload.url,
        proof_of_address_url: proofOfAddressUpload.url,
        tax_id: formData.tax_id || null,
        tax_id_type: formData.tax_id ? taxIdLabel : null,
        source_of_funds: formData.source_of_funds || null,
        source_of_funds_documents: sourceOfFundsUpload.url ? [sourceOfFundsUpload.url] : null,
        occupation: formData.occupation || null,
        employer_name: formData.employer_name || null,
        verification_level: targetTier,
        kyc_tier: 'tier_0',
      };

      // Use UPDATE for upgrades (existing user), INSERT for new submissions
      if (isUpgradeFlow) {
        console.log('Updating existing KYC for upgrade:', JSON.stringify(insertData, null, 2));
        
        const { data, error } = await supabase
          .from("kyc_verifications")
          .update({
            address: insertData.address,
            proof_of_address_url: insertData.proof_of_address_url,
            tax_id: insertData.tax_id,
            tax_id_type: insertData.tax_id_type,
            source_of_funds: insertData.source_of_funds,
            source_of_funds_documents: insertData.source_of_funds_documents,
            occupation: insertData.occupation,
            employer_name: insertData.employer_name,
            verification_level: targetTier as "tier_0" | "tier_1" | "tier_2" | "tier_3",
            status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select();

        if (error) {
          console.error('Update error:', error);
          throw new Error(error.message || 'Failed to update verification data');
        }
        
        // Check if update actually affected any rows (RLS may silently block)
        if (!data || data.length === 0) {
          console.error('Update returned no data - RLS may have blocked the operation');
          throw new Error('Unable to update your verification. Please try again or contact support.');
        }
      } else {
        console.log('Inserting new KYC data:', JSON.stringify(insertData, null, 2));
        
        const { error } = await supabase
          .from("kyc_verifications")
          .insert(insertData)
          .select();

        if (error) {
          console.error('Insert error:', error);
          throw new Error(error.message || 'Failed to save verification data');
        }
      }

      toast({
        title: "KYC Submitted",
        description: `Your ${getTierDisplayName(targetTier)} verification has been submitted for review.`,
      });

      // Non-blocking tracking
      setTimeout(() => {
        trackActivity('kyc_completion').catch(console.error);
      }, 0);
      
      checkKYCStatus();
    } catch (error: any) {
      console.error('KYC submission error:', error);
      toast({
        title: "Submission Failed",
        description: parseKYCError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-6 w-6 text-success" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Clock className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getTotalSteps = () => {
    if (targetTier === 'tier_3') return 4;
    if (targetTier === 'tier_2') return 4; // Premium also requires source of funds
    return 2;
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      return formData.full_name && formData.date_of_birth && formData.country_code;
    }
    if (currentStep === 2) {
      // Can proceed if uploads are complete or in progress (stalled counts as in progress)
      const activeStatuses = ['uploading', 'compressing', 'complete', 'stalled'];
      const idOk = activeStatuses.includes(idDocumentUpload.status);
      const selfieOk = activeStatuses.includes(selfieUpload.status);
      return formData.id_type && formData.id_number && idOk && selfieOk;
    }
    if (currentStep === 3) {
      const activeStatuses = ['uploading', 'compressing', 'complete', 'stalled'];
      const proofOk = activeStatuses.includes(proofOfAddressUpload.status);
      return formData.address && proofOk && formData.tax_id;
    }
    if (currentStep === 4) {
      // For Tier 2+, source of funds document is required
      const activeStatuses = ['uploading', 'compressing', 'complete', 'stalled'];
      const sourceOk = activeStatuses.includes(sourceOfFundsUpload.status);
      return formData.source_of_funds && formData.occupation && sourceOk;
    }
    return true;
  };

  // File upload status component
  const FileUploadStatus = ({ 
    uploadState, 
    icon: Icon, 
    idleLabel,
    onRetry,
    onCancel
  }: { 
    uploadState: UploadState; 
    icon: React.ElementType; 
    idleLabel: string;
    onRetry?: () => void;
    onCancel?: () => void;
  }) => {
    switch (uploadState.status) {
      case 'idle':
        return (
          <>
            <Icon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{idleLabel}</span>
            <span className="text-xs text-muted-foreground">Tap to take photo or choose file</span>
          </>
        );
      case 'compressing':
        return (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Compressing...</span>
            <Progress value={uploadState.progress} className="w-32 h-2" />
            {onCancel && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
                className="text-xs h-6"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      case 'uploading':
        return (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Uploading {uploadState.progress}%</span>
            <Progress value={uploadState.progress} className="w-32 h-2" />
            {onCancel && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
                className="text-xs h-6"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      case 'stalled':
        return (
          <div className="flex flex-col items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-8 w-8" />
            <span className="text-sm font-medium">Upload seems slow</span>
            <span className="text-xs">Network may be unstable</span>
            <div className="flex gap-2 mt-1">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
                  className="text-xs h-6"
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRetry?.(); }}
                className="text-xs h-6"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        );
      case 'complete':
        return (
          <div className="flex flex-col items-center gap-2 text-green-600">
            <CheckCircle2 className="h-8 w-8" />
            <span className="text-sm font-medium truncate max-w-[200px]">{uploadState.file?.name || 'Previously uploaded'}</span>
            <span className="text-xs">✓ Uploaded</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center gap-2 text-destructive">
            <XCircle className="h-8 w-8" />
            <span className="text-sm font-medium">Upload failed</span>
            <span className="text-xs">{uploadState.error}</span>
            <span className="text-xs underline cursor-pointer" onClick={onRetry}>Tap to retry</span>
          </div>
        );
    }
  };

  // Show status if KYC exists
  if (kycStatus) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate("/settings")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(kycStatus.status)}
              KYC Verification Status
            </CardTitle>
            <CardDescription>
              Requested: <Badge className={getTierColor(kycStatus.verification_level || 'tier_1')}>
                {getTierDisplayName(kycStatus.verification_level || 'tier_1')}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kycStatus.status === 'pending' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your verification is being reviewed. This typically takes 1-2 business days.
                </AlertDescription>
              </Alert>
            )}
            {kycStatus.status === 'approved' && (
              <div className="space-y-4">
                <Alert className="border-success bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    Your account has been verified at {getTierDisplayName(kycStatus.kyc_tier || 'tier_1')} level.
                  </AlertDescription>
                </Alert>

                {limits && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Your Transaction Limits</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Daily Limit</span>
                          <span>${limits.daily_total_usd.toFixed(2)} / ${limits.daily_limit_usd.toFixed(2)}</span>
                        </div>
                        <Progress value={(limits.daily_total_usd / limits.daily_limit_usd) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          ${limits.daily_remaining_usd.toFixed(2)} remaining today
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Monthly Limit</span>
                          <span>${limits.monthly_total_usd.toFixed(2)} / ${limits.monthly_limit_usd.toFixed(2)}</span>
                        </div>
                        <Progress value={(limits.monthly_total_usd / limits.monthly_limit_usd) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          ${limits.monthly_remaining_usd.toFixed(2)} remaining this month
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Upgrade option */}
                {kycStatus.kyc_tier !== 'tier_3' && (
                  <Card className="border-primary/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Want higher limits?</p>
                          <p className="text-sm text-muted-foreground">
                            Upgrade to {getTierDisplayName(kycStatus.kyc_tier === 'tier_1' ? 'tier_2' : 'tier_3')} for increased transaction limits
                          </p>
                        </div>
                        <Button onClick={() => {
                          // Pre-populate form with existing verified data
                          setFormData(prev => ({
                            ...prev,
                            full_name: kycStatus.full_name || prev.full_name,
                            date_of_birth: kycStatus.date_of_birth || prev.date_of_birth,
                            id_type: kycStatus.id_type || prev.id_type,
                            id_number: kycStatus.id_number || prev.id_number,
                            country_code: kycStatus.country_code || prev.country_code,
                          }));
                          
                          // Mark previous documents as "already uploaded"
                          if (kycStatus.id_document_url) {
                            setIdDocumentUpload({ 
                              status: 'complete', 
                              progress: 100, 
                              url: kycStatus.id_document_url, 
                              error: null, 
                              file: null 
                            });
                          }
                          if (kycStatus.selfie_url) {
                            setSelfieUpload({ 
                              status: 'complete', 
                              progress: 100, 
                              url: kycStatus.selfie_url, 
                              error: null, 
                              file: null 
                            });
                          }
                          
                          // Set upgrade flow flag and target tier
                          setIsUpgradeFlow(true);
                          const newTier = kycStatus.kyc_tier === 'tier_1' ? 'tier_2' : 'tier_3';
                          setTargetTier(newTier);
                          
                          // Skip to step 3 (Address & Tax) for upgrades since ID/selfie already verified
                          setCurrentStep(3);
                          
                          setKycStatus(null);
                        }}>
                          Upgrade
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {kycStatus.status === 'rejected' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your verification was rejected.
                    {kycStatus.rejection_reason && (
                      <span className="block mt-1">Reason: {kycStatus.rejection_reason}</span>
                    )}
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setKycStatus(null)}>Resubmit Verification</Button>
              </div>
            )}
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto p-4">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate("/settings")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Button>
      </div>

      {/* Tier Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Choose Verification Level
          </CardTitle>
          <CardDescription>
            Higher verification levels unlock higher transaction limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.filter(t => t.tier !== 'tier_0').map((tier) => (
              <Card 
                key={tier.tier}
                className={`cursor-pointer transition-all ${targetTier === tier.tier ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                onClick={() => {
                  setTargetTier(tier.tier);
                  setCurrentStep(1);
                }}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getTierColor(tier.tier)}>{tier.name}</Badge>
                    {targetTier === tier.tier && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-2xl font-bold">${tier.daily_limit_usd.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">daily limit</p>
                  <p className="text-sm mt-2">${tier.monthly_limit_usd.toLocaleString()}/month</p>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Requires:</p>
                    <ul className="text-xs mt-1 space-y-1">
                      {tier.required_documents.map((doc, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          {doc.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of {getTotalSteps()}</span>
            <span className="text-sm text-muted-foreground">
              {currentStep === 1 && 'Personal Information'}
              {currentStep === 2 && 'Identity Verification'}
              {currentStep === 3 && 'Address & Tax'}
              {currentStep === 4 && 'Source of Funds'}
            </span>
          </div>
          <Progress value={(currentStep / getTotalSteps()) * 100} />
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {getTierDisplayName(targetTier)} Verification
          </CardTitle>
          <CardDescription>
            Complete all required information for verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Personal Information</h3>
                </div>

                <div>
                  <Label htmlFor="full_name">Full Name (as on ID)</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full legal name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="country_code">Country</Label>
                  <Select
                    value={formData.country_code}
                    onValueChange={(value) => {
                      setFormData({ ...formData, country_code: value, id_type: '' });
                      setUserCountry(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                      <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                      <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                      <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
                      <SelectItem value="UG">🇺🇬 Uganda</SelectItem>
                      <SelectItem value="TZ">🇹🇿 Tanzania</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Identity */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Identity Verification</h3>
                </div>

                <div>
                  <Label htmlFor="id_type">ID Type</Label>
                  <Select
                    value={formData.id_type}
                    onValueChange={(value) => setFormData({ ...formData, id_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIdTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="id_number">ID Number</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    placeholder="Enter your ID number"
                    required
                  />
                </div>

                <div>
                  <Label>ID Document (Front)</Label>
                  <div className="mt-2 space-y-2">
                    {/* Primary upload area */}
                    <div 
                      className={`relative flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors ${
                        idDocumentUpload.status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                        idDocumentUpload.status === 'error' ? 'border-destructive bg-destructive/10' : 
                        idDocumentUpload.status === 'stalled' ? 'border-yellow-500 bg-yellow-950/20' :
                        'hover:bg-accent'
                      }`}
                    >
                      <FileUploadStatus 
                        uploadState={idDocumentUpload} 
                        icon={Camera} 
                        idleLabel={isNative ? "Tap to Take Photo" : "Take Photo of ID"}
                        onRetry={() => resetUpload(setIdDocumentUpload)}
                        onCancel={() => cancelUpload(setIdDocumentUpload, idDocumentUpload)}
                      />
                      
                      {/* For native: use button with Capacitor Camera */}
                      {isNative && (idDocumentUpload.status === 'idle' || idDocumentUpload.status === 'error' || idDocumentUpload.status === 'stalled') && (
                        <Button
                          type="button"
                          variant="outline"
                          className="absolute inset-0 w-full h-full opacity-0"
                          onClick={() => captureWithCapacitor('id', setIdDocumentUpload, CameraSource.Camera)}
                        />
                      )}
                      
                      {/* For browser: use file input with no capture attribute for reliability */}
                      {!isNative && (
                        <input
                          ref={idDocInputRef}
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            zIndex: 10,
                            pointerEvents: (idDocumentUpload.status === 'idle' || idDocumentUpload.status === 'error' || idDocumentUpload.status === 'stalled') ? 'auto' : 'none',
                          }}
                          onClick={() => {
                            console.log('[id-document] Input clicked, setting awaitingFile');
                            setAwaitingFile('id');
                          }}
                          onChange={(e) => {
                            console.log('[id-document] onChange fired, files:', e.target.files);
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('[id-document] Processing file:', file.name, file.size);
                              handleFileSelect(file, 'id', setIdDocumentUpload);
                              setAwaitingFile(null);
                            }
                            e.target.value = '';
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Secondary: Gallery picker for native */}
                    {isNative && (idDocumentUpload.status === 'idle' || idDocumentUpload.status === 'error' || idDocumentUpload.status === 'stalled') && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-muted-foreground"
                        onClick={() => captureWithCapacitor('id', setIdDocumentUpload, CameraSource.Photos)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Choose from Gallery
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Selfie (holding ID next to face)</Label>
                  <div className="mt-2">
                    <div 
                      className={`relative flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors ${
                        selfieUpload.status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                        selfieUpload.status === 'error' ? 'border-destructive bg-destructive/10' : 
                        selfieUpload.status === 'stalled' ? 'border-yellow-500 bg-yellow-950/20' :
                        'hover:bg-accent'
                      }`}
                    >
                      <FileUploadStatus 
                        uploadState={selfieUpload} 
                        icon={Camera} 
                        idleLabel={isNative ? "Tap to Take Selfie" : "Take Selfie"}
                        onRetry={() => resetUpload(setSelfieUpload)}
                        onCancel={() => cancelUpload(setSelfieUpload, selfieUpload)}
                      />
                      
                      {/* For native: use button with Capacitor Camera */}
                      {isNative && (selfieUpload.status === 'idle' || selfieUpload.status === 'error' || selfieUpload.status === 'stalled') && (
                        <Button
                          type="button"
                          variant="outline"
                          className="absolute inset-0 w-full h-full opacity-0"
                          onClick={() => captureWithCapacitor('selfie', setSelfieUpload, CameraSource.Camera)}
                        />
                      )}
                      
                      {/* For browser: use file input */}
                      {!isNative && (
                        <input
                          ref={selfieInputRef}
                          type="file"
                          accept="image/*"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            zIndex: 10,
                            pointerEvents: (selfieUpload.status === 'idle' || selfieUpload.status === 'error' || selfieUpload.status === 'stalled') ? 'auto' : 'none',
                          }}
                          onClick={() => {
                            console.log('[selfie] Input clicked, setting awaitingFile');
                            setAwaitingFile('selfie');
                          }}
                          onChange={(e) => {
                            console.log('[selfie] onChange fired, files:', e.target.files);
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('[selfie] Processing file:', file.name, file.size);
                              handleFileSelect(file, 'selfie', setSelfieUpload);
                              setAwaitingFile(null);
                            }
                            e.target.value = '';
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Address & Tax (Tier 2+) */}
            {currentStep === 3 && (targetTier === 'tier_2' || targetTier === 'tier_3') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Address & Tax Verification</h3>
                </div>

                {/* Tax ID Section - Moved to top for visibility */}
                <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Tax Identification</span>
                    <span className="text-destructive text-sm">*Required</span>
                  </div>
                  <Label htmlFor="tax_id">
                    {taxIdLabel}
                  </Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder={`Enter your ${taxIdLabel}`}
                    required
                    className="mt-1"
                  />
                  {formData.country_code === 'NG' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your 11-digit Bank Verification Number
                    </p>
                  )}
                  {formData.country_code === 'KE' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your Kenya Revenue Authority PIN
                    </p>
                  )}
                  {formData.country_code === 'ZA' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your South African Tax Number
                    </p>
                  )}
                  {formData.country_code === 'GH' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your Ghana Revenue Authority TIN
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="address">Residential Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter your full residential address"
                    required
                  />
                </div>

                <div>
                  <Label>Proof of Address</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Utility bill, bank statement, or government letter dated within 3 months
                  </p>
                  <div className="mt-2 space-y-2">
                    <div 
                      className={`relative flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors ${
                        proofOfAddressUpload.status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                        proofOfAddressUpload.status === 'error' ? 'border-destructive bg-destructive/10' : 
                        proofOfAddressUpload.status === 'stalled' ? 'border-yellow-500 bg-yellow-950/20' :
                        'hover:bg-accent'
                      }`}
                    >
                      <FileUploadStatus 
                        uploadState={proofOfAddressUpload} 
                        icon={Camera} 
                        idleLabel={isNative ? "Tap to Take Photo" : "Take Photo of Document"}
                        onRetry={() => resetUpload(setProofOfAddressUpload)}
                        onCancel={() => cancelUpload(setProofOfAddressUpload, proofOfAddressUpload)}
                      />
                      
                      {isNative && (proofOfAddressUpload.status === 'idle' || proofOfAddressUpload.status === 'error' || proofOfAddressUpload.status === 'stalled') && (
                        <Button
                          type="button"
                          variant="outline"
                          className="absolute inset-0 w-full h-full opacity-0"
                          onClick={() => captureWithCapacitor('proofOfAddress', setProofOfAddressUpload, CameraSource.Camera)}
                        />
                      )}
                      
                      {/* For browser: use file input with overlay pattern (same as ID/Selfie) */}
                      {!isNative && (
                        <input
                          ref={proofAddressInputRef}
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            zIndex: 10,
                            pointerEvents: (proofOfAddressUpload.status === 'idle' || proofOfAddressUpload.status === 'error' || proofOfAddressUpload.status === 'stalled') ? 'auto' : 'none',
                          }}
                          onClick={() => {
                            console.log('[proof-address] Input clicked, setting awaitingFile');
                            setAwaitingFile('proofOfAddress');
                          }}
                          onChange={(e) => {
                            console.log('[proof-address] onChange fired, files:', e.target.files);
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('[proof-address] Processing file:', file.name, file.size);
                              handleFileSelect(file, 'proofOfAddress', setProofOfAddressUpload);
                              setAwaitingFile(null);
                            }
                            e.target.value = '';
                          }}
                        />
                      )}
                    </div>
                    
                    {isNative && (proofOfAddressUpload.status === 'idle' || proofOfAddressUpload.status === 'error' || proofOfAddressUpload.status === 'stalled') && (
                      <Button 
                        type="button" variant="ghost" size="sm" className="w-full text-muted-foreground"
                        onClick={() => captureWithCapacitor('proofOfAddress', setProofOfAddressUpload, CameraSource.Photos)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Choose from Gallery
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Source of Funds (Tier 2+) */}
            {currentStep === 4 && (targetTier === 'tier_2' || targetTier === 'tier_3') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Source of Funds</h3>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This information helps us comply with anti-money laundering regulations.
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="source_of_funds">Primary Source of Funds</Label>
                  <Select
                    value={formData.source_of_funds}
                    onValueChange={(value) => setFormData({ ...formData, source_of_funds: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source of funds" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OF_FUNDS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    placeholder="Enter your occupation"
                    required
                  />
                </div>

                {formData.source_of_funds === 'Employment / Salary' && (
                  <div>
                    <Label htmlFor="employer_name">Employer Name</Label>
                    <Input
                      id="employer_name"
                      value={formData.employer_name}
                      onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                      placeholder="Enter your employer's name"
                    />
                  </div>
                )}

                <div>
                  <Label>
                    Supporting Documentation 
                    {(targetTier === 'tier_2' || targetTier === 'tier_3') ? ' (Required)' : ' (Optional)'}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Bank statement, pay slip, or business registration
                  </p>
                  <div className="mt-2 space-y-2">
                    <div 
                      className={`relative flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors ${
                        sourceOfFundsUpload.status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 
                        sourceOfFundsUpload.status === 'error' ? 'border-destructive bg-destructive/10' : 
                        sourceOfFundsUpload.status === 'stalled' ? 'border-yellow-500 bg-yellow-950/20' :
                        'hover:bg-accent'
                      }`}
                    >
                      <FileUploadStatus 
                        uploadState={sourceOfFundsUpload} 
                        icon={FolderOpen} 
                        idleLabel={`Upload Document ${(targetTier === 'tier_2' || targetTier === 'tier_3') ? '(Required)' : '(Optional)'}`}
                        onRetry={() => resetUpload(setSourceOfFundsUpload)}
                        onCancel={() => cancelUpload(setSourceOfFundsUpload, sourceOfFundsUpload)}
                      />
                      
                      {isNative && (sourceOfFundsUpload.status === 'idle' || sourceOfFundsUpload.status === 'error' || sourceOfFundsUpload.status === 'stalled') && (
                        <Button
                          type="button"
                          variant="outline"
                          className="absolute inset-0 w-full h-full opacity-0"
                          onClick={() => captureWithCapacitor('sourceOfFunds', setSourceOfFundsUpload, CameraSource.Photos)}
                        />
                      )}
                      
                      {/* For browser: use file input with overlay pattern (same as ID/Selfie) */}
                      {!isNative && (
                        <input
                          ref={sourceFundsInputRef}
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            zIndex: 10,
                            pointerEvents: (sourceOfFundsUpload.status === 'idle' || sourceOfFundsUpload.status === 'error' || sourceOfFundsUpload.status === 'stalled') ? 'auto' : 'none',
                          }}
                          onClick={() => {
                            console.log('[source-funds] Input clicked, setting awaitingFile');
                            setAwaitingFile('sourceOfFunds');
                          }}
                          onChange={(e) => {
                            console.log('[source-funds] onChange fired, files:', e.target.files);
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('[source-funds] Processing file:', file.name, file.size);
                              handleFileSelect(file, 'sourceOfFunds', setSourceOfFundsUpload);
                              setAwaitingFile(null);
                            }
                            e.target.value = '';
                          }}
                        />
                      )}
                    </div>
                    
                    {isNative && (sourceOfFundsUpload.status === 'idle' || sourceOfFundsUpload.status === 'error' || sourceOfFundsUpload.status === 'stalled') && (
                      <Button 
                        type="button" variant="ghost" size="sm" className="w-full text-muted-foreground"
                        onClick={() => captureWithCapacitor('sourceOfFunds', setSourceOfFundsUpload, CameraSource.Camera)}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo Instead
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              ) : (
                <div />
              )}

              {currentStep < getTotalSteps() ? (
                <Button 
                  type="button" 
                  onClick={() => setCurrentStep(s => s + 1)}
                  disabled={!canProceedToNextStep()}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={!canSubmit} className="min-w-[200px]">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingStep || "Saving..."}
                    </span>
                  ) : !canSubmit ? (
                    <span className="flex items-center gap-2">
                      {/* Check if any required document is missing (idle) vs still uploading */}
                      {(() => {
                        const idMissing = idDocumentUpload.status === 'idle';
                        const selfieMissing = selfieUpload.status === 'idle';
                        const proofMissing = (targetTier === 'tier_2' || targetTier === 'tier_3') && proofOfAddressUpload.status === 'idle';
                        const sourceMissing = (targetTier === 'tier_2' || targetTier === 'tier_3') && sourceOfFundsUpload.status === 'idle';
                        
                        if (idMissing) return "Upload ID document";
                        if (selfieMissing) return "Upload selfie photo";
                        if (proofMissing) return "Upload proof of address";
                        if (sourceMissing) return "Upload supporting document";
                        
                        // If not missing but not complete, it's uploading
                        return (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Waiting for uploads...
                          </>
                        );
                      })()}
                    </span>
                  ) : (
                    "Submit for Verification"
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
