// Country-specific phone validation rules for African countries
export interface PhoneRule {
  country: string;
  flag: string;
  digits: number; // Number of digits after country code
  format: string; // Display format template
  example: string; // Example phone number
}

// All 16 supported African countries - dynamic loading from DB for auth, static fallback for validation
export const COUNTRY_PHONE_RULES: Record<string, PhoneRule> = {
  // Existing enabled countries
  "+234": {
    country: "Nigeria",
    flag: "🇳🇬",
    digits: 10,
    format: "+234 XXX XXX XXXX",
    example: "+234 803 123 4567"
  },
  "+254": {
    country: "Kenya",
    flag: "🇰🇪",
    digits: 9,
    format: "+254 XXX XXX XXX",
    example: "+254 712 345 678"
  },
  "+27": {
    country: "South Africa",
    flag: "🇿🇦",
    digits: 9,
    format: "+27 XX XXX XXXX",
    example: "+27 82 123 4567"
  },
  "+233": {
    country: "Ghana",
    flag: "🇬🇭",
    digits: 9,
    format: "+233 XX XXX XXXX",
    example: "+233 24 123 4567"
  },
  "+256": {
    country: "Uganda",
    flag: "🇺🇬",
    digits: 9,
    format: "+256 XXX XXX XXX",
    example: "+256 712 345 678"
  },
  "+255": {
    country: "Tanzania",
    flag: "🇹🇿",
    digits: 9,
    format: "+255 XXX XXX XXX",
    example: "+255 712 345 678"
  },
  // New countries (admin must enable)
  "+20": {
    country: "Egypt",
    flag: "🇪🇬",
    digits: 10,
    format: "+20 XXX XXX XXXX",
    example: "+20 100 123 4567"
  },
  "+212": {
    country: "Morocco",
    flag: "🇲🇦",
    digits: 9,
    format: "+212 XXX XXX XXX",
    example: "+212 612 345 678"
  },
  "+237": {
    country: "Cameroon",
    flag: "🇨🇲",
    digits: 9,
    format: "+237 XXX XXX XXX",
    example: "+237 670 123 456"
  },
  "+225": {
    country: "Côte d'Ivoire",
    flag: "🇨🇮",
    digits: 10,
    format: "+225 XX XX XXX XXX",
    example: "+225 07 12 345 678"
  },
  "+221": {
    country: "Senegal",
    flag: "🇸🇳",
    digits: 9,
    format: "+221 XX XXX XXXX",
    example: "+221 77 123 4567"
  },
  "+250": {
    country: "Rwanda",
    flag: "🇷🇼",
    digits: 9,
    format: "+250 XXX XXX XXX",
    example: "+250 788 123 456"
  },
  "+251": {
    country: "Ethiopia",
    flag: "🇪🇹",
    digits: 9,
    format: "+251 XXX XXX XXX",
    example: "+251 911 234 567"
  },
  "+263": {
    country: "Zimbabwe",
    flag: "🇿🇼",
    digits: 9,
    format: "+263 XX XXX XXXX",
    example: "+263 77 123 4567"
  },
  "+267": {
    country: "Botswana",
    flag: "🇧🇼",
    digits: 8,
    format: "+267 XX XXX XXX",
    example: "+267 71 234 567"
  },
  "+260": {
    country: "Zambia",
    flag: "🇿🇲",
    digits: 9,
    format: "+260 XXX XXX XXX",
    example: "+260 977 123 456"
  }
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates and normalizes a phone number based on country code
 */
export function validatePhoneNumber(countryCode: string, phoneNumber: string): ValidationResult {
  const rules = COUNTRY_PHONE_RULES[countryCode];
  
  if (!rules) {
    return { 
      valid: false, 
      error: "Unsupported country code" 
    };
  }

  // Remove all non-digit characters
  const cleanedNumber = phoneNumber.replace(/\D/g, '');
  
  if (cleanedNumber.length === 0) {
    return { 
      valid: false, 
      error: "Phone number is required" 
    };
  }

  if (cleanedNumber.length < rules.digits) {
    return { 
      valid: false, 
      error: `${rules.country} numbers need ${rules.digits - cleanedNumber.length} more digit${rules.digits - cleanedNumber.length > 1 ? 's' : ''}` 
    };
  }

  if (cleanedNumber.length > rules.digits) {
    return { 
      valid: false, 
      error: `${rules.country} numbers must be exactly ${rules.digits} digits after ${countryCode}` 
    };
  }

  // Valid! Return normalized E.164 format
  return {
    valid: true,
    normalized: `${countryCode}${cleanedNumber}`
  };
}

/**
 * Formats a phone number for display with spaces
 */
export function formatPhoneNumber(phoneNumber: string, countryCode: string): string {
  const rules = COUNTRY_PHONE_RULES[countryCode];
  if (!rules) return phoneNumber;

  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Apply formatting based on country
  switch (countryCode) {
    case "+234": // XXX XXX XXXX
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
    
    case "+254": // XXX XXX XXX
    case "+256":
    case "+255":
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
    
    case "+27": // XX XXX XXXX
    case "+233":
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)}`;
    
    default:
      return cleaned;
  }
}

/**
 * Attempts to auto-correct common phone number formats
 */
export function autoCorrectPhoneNumber(phoneNumber: string, defaultCountryCode: string = "+234"): string {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Already in E.164 format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Starts with 0 (local format) - remove 0 and add country code
  if (cleaned.startsWith('0')) {
    return `${defaultCountryCode}${cleaned.substring(1)}`;
  }
  
  // Starts with country code without + (e.g., 234...)
  if (cleaned.startsWith('234')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('254') || cleaned.startsWith('27') || cleaned.startsWith('233') || 
      cleaned.startsWith('256') || cleaned.startsWith('255')) {
    return `+${cleaned}`;
  }
  
  // Plain number - add default country code
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Validates a full E.164 phone number
 */
export function validateE164PhoneNumber(phoneNumber: string): ValidationResult {
  // Extract country code (e.g., +234 from +2348031234567)
  const countryCodeMatch = phoneNumber.match(/^\+(\d{2,3})/);
  
  if (!countryCodeMatch) {
    return {
      valid: false,
      error: "Invalid phone number format. Must start with country code (e.g., +234)"
    };
  }
  
  const countryCode = `+${countryCodeMatch[1]}`;
  const rules = COUNTRY_PHONE_RULES[countryCode];
  
  if (!rules) {
    // Check if it's a 3-digit country code (e.g., +234)
    const threeDigitCode = phoneNumber.substring(0, 4);
    if (COUNTRY_PHONE_RULES[threeDigitCode]) {
      const digits = phoneNumber.substring(4).replace(/\D/g, '');
      return validatePhoneNumber(threeDigitCode, digits);
    }
    
    return {
      valid: false,
      error: "Country code not supported"
    };
  }
  
  const digits = phoneNumber.substring(countryCode.length).replace(/\D/g, '');
  return validatePhoneNumber(countryCode, digits);
}
