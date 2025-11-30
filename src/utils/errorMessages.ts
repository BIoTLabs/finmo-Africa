// User-friendly error messages for OTP operations
export const OTP_ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  INVALID_PHONE: 'INVALID_PHONE',
  CARRIER_BLOCKED: 'CARRIER_BLOCKED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TWILIO_ERROR: 'TWILIO_ERROR',
} as const;

export type OTPErrorCode = typeof OTP_ERROR_CODES[keyof typeof OTP_ERROR_CODES];

interface OTPErrorData {
  error: string;
  errorCode?: OTPErrorCode;
  minutesLeft?: number;
  retryAfter?: string;
}

export const getOTPErrorMessage = (errorData: OTPErrorData): string => {
  if (!errorData.errorCode) {
    return errorData.error;
  }

  switch (errorData.errorCode) {
    case OTP_ERROR_CODES.RATE_LIMITED:
      const minutes = errorData.minutesLeft || 1;
      return `You've requested too many codes. For security, please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before trying again.`;
    
    case OTP_ERROR_CODES.ACCOUNT_NOT_FOUND:
      return "No account found with this phone number. Please check the number or sign up first.";
    
    case OTP_ERROR_CODES.INVALID_PHONE:
      return "This phone number format is not valid. Please check and try again with country code.";
    
    case OTP_ERROR_CODES.CARRIER_BLOCKED:
      return "Unable to send SMS to this number. Your carrier may be blocking verification codes. Try the voice call option.";
    
    case OTP_ERROR_CODES.SERVICE_UNAVAILABLE:
      return "Our verification service is temporarily unavailable. Please try again in a few minutes or use the voice call option.";
    
    case OTP_ERROR_CODES.SYSTEM_ERROR:
      return "A temporary system error occurred. Please try again in a moment.";
    
    case OTP_ERROR_CODES.NETWORK_ERROR:
      return "Unable to reach our servers. Please check your internet connection and try again.";
    
    case OTP_ERROR_CODES.TWILIO_ERROR:
      return errorData.error || "Unable to send verification code. Please try again or contact support.";
    
    default:
      return errorData.error;
  }
};

// Extract error data from Supabase function response
export const extractOTPError = (data: any, error: any): OTPErrorData => {
  // First check the data response
  if (data?.error) {
    return {
      error: data.error,
      errorCode: data.errorCode,
      minutesLeft: data.minutesLeft,
      retryAfter: data.retryAfter,
    };
  }

  // Then check error object
  if (error?.message) {
    try {
      // Try to parse JSON from error message (FunctionsHttpError)
      const parsed = JSON.parse(error.message);
      return {
        error: parsed.error || error.message,
        errorCode: parsed.errorCode,
        minutesLeft: parsed.minutesLeft,
        retryAfter: parsed.retryAfter,
      };
    } catch {
      return {
        error: error.message,
        errorCode: OTP_ERROR_CODES.NETWORK_ERROR,
      };
    }
  }

  return {
    error: "An unexpected error occurred. Please try again.",
    errorCode: OTP_ERROR_CODES.SYSTEM_ERROR,
  };
};
