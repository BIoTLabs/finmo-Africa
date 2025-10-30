import { useMemo } from 'react';
import { validatePhoneNumber, formatPhoneNumber, COUNTRY_PHONE_RULES, type PhoneRule } from '@/utils/phoneValidation';

interface UsePhoneValidationResult {
  isValid: boolean;
  error?: string;
  formatted: string;
  progress: string;
  rules: PhoneRule;
  normalized?: string;
}

/**
 * React hook for phone number validation with country-specific rules
 */
export function usePhoneValidation(countryCode: string, phoneNumber: string): UsePhoneValidationResult {
  return useMemo(() => {
    const rules = COUNTRY_PHONE_RULES[countryCode];
    
    if (!rules) {
      return {
        isValid: false,
        error: 'Invalid country code',
        formatted: phoneNumber,
        progress: '0/0',
        rules: { country: '', flag: '', digits: 0, format: '', example: '' }
      };
    }

    const validation = validatePhoneNumber(countryCode, phoneNumber);
    const cleaned = phoneNumber.replace(/\D/g, '');
    const formatted = formatPhoneNumber(phoneNumber, countryCode);
    const progress = `${cleaned.length}/${rules.digits}`;

    return {
      isValid: validation.valid,
      error: validation.error,
      formatted,
      progress,
      rules,
      normalized: validation.normalized
    };
  }, [countryCode, phoneNumber]);
}
