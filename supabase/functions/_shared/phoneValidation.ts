// Shared phone validation for edge functions
export interface PhoneRule {
  country: string;
  digits: number;
  format: string;
}

export const COUNTRY_PHONE_RULES: Record<string, PhoneRule> = {
  "+234": { country: "Nigeria", digits: 10, format: "+234 XXX XXX XXXX" },
  "+254": { country: "Kenya", digits: 9, format: "+254 XXX XXX XXX" },
  "+27": { country: "South Africa", digits: 9, format: "+27 XX XXX XXXX" },
  "+233": { country: "Ghana", digits: 9, format: "+233 XX XXX XXXX" },
  "+256": { country: "Uganda", digits: 9, format: "+256 XXX XXX XXX" },
  "+255": { country: "Tanzania", digits: 9, format: "+255 XXX XXX XXX" }
};

export interface ValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Validates and normalizes phone number to E.164 format
 */
export function validateAndNormalizePhone(phoneNumber: string): ValidationResult {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Auto-correct common formats
    if (cleaned.startsWith('0')) {
      // Local format (e.g., 08031234567) - assume Nigeria as default
      cleaned = '+234' + cleaned.substring(1);
    } else if (cleaned.startsWith('234')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('254') || cleaned.startsWith('27') || 
               cleaned.startsWith('233') || cleaned.startsWith('256') || 
               cleaned.startsWith('255')) {
      cleaned = '+' + cleaned;
    } else {
      // Plain number without country code - assume Nigeria
      cleaned = '+234' + cleaned;
    }
  }

  // Extract country code
  let countryCode = '';
  let digits = '';
  
  // Try 4-digit country codes first (e.g., +234)
  if (cleaned.length >= 4) {
    const fourDigitCode = cleaned.substring(0, 4);
    if (COUNTRY_PHONE_RULES[fourDigitCode]) {
      countryCode = fourDigitCode;
      digits = cleaned.substring(4);
    }
  }
  
  // Try 3-digit country codes (e.g., +27)
  if (!countryCode && cleaned.length >= 3) {
    const threeDigitCode = cleaned.substring(0, 3);
    if (COUNTRY_PHONE_RULES[threeDigitCode]) {
      countryCode = threeDigitCode;
      digits = cleaned.substring(3);
    }
  }

  if (!countryCode) {
    return {
      valid: false,
      error: "Invalid or unsupported country code"
    };
  }

  const rules = COUNTRY_PHONE_RULES[countryCode];
  const digitCount = digits.replace(/\D/g, '').length;

  if (digitCount === 0) {
    return {
      valid: false,
      error: "Phone number is required"
    };
  }

  if (digitCount < rules.digits) {
    return {
      valid: false,
      error: `${rules.country} numbers must have exactly ${rules.digits} digits after ${countryCode}. You provided ${digitCount}.`
    };
  }

  if (digitCount > rules.digits) {
    return {
      valid: false,
      error: `${rules.country} numbers must have exactly ${rules.digits} digits after ${countryCode}. You provided ${digitCount}.`
    };
  }

  // Valid! Return normalized E.164 format
  return {
    valid: true,
    normalized: `${countryCode}${digits.replace(/\D/g, '')}`
  };
}
