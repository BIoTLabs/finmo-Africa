// Standardized error handling for edge functions

export interface StandardError {
  code: string;
  message: string;
  statusCode: number;
}

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials provided',
    statusCode: 401
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    statusCode: 401
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    message: 'Your session has expired. Please log in again.',
    statusCode: 401
  },

  // Rate limiting
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    statusCode: 429
  },

  // Validation errors
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    message: 'Invalid input provided',
    statusCode: 400
  },
  INVALID_PHONE: {
    code: 'INVALID_PHONE',
    message: 'Invalid phone number format',
    statusCode: 400
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required field is missing',
    statusCode: 400
  },

  // Resource errors
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    statusCode: 404
  },
  ALREADY_EXISTS: {
    code: 'ALREADY_EXISTS',
    message: 'Resource already exists',
    statusCode: 409
  },

  // Business logic errors
  INSUFFICIENT_FUNDS: {
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds for this operation',
    statusCode: 400
  },
  OPERATION_NOT_ALLOWED: {
    code: 'OPERATION_NOT_ALLOWED',
    message: 'This operation is not allowed',
    statusCode: 403
  },

  // Server errors
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    statusCode: 500
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable. Please try again later.',
    statusCode: 503
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    message: 'External service error. Please try again.',
    statusCode: 502
  }
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  customMessage?: string,
  corsHeaders?: Record<string, string>
): Response {
  const error = ERROR_CODES[errorCode];
  
  return new Response(
    JSON.stringify({
      success: false,
      error: error.code,
      message: customMessage || error.message
    }),
    {
      status: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(corsHeaders || {})
      }
    }
  );
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(
  data: any,
  corsHeaders?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...(corsHeaders || {})
      }
    }
  );
}

/**
 * Logs error without exposing sensitive information
 */
export function logError(context: string, error: any, sensitiveData?: Record<string, any>) {
  const errorInfo = error instanceof Error ? error.message : String(error);
  
  // Log generic error info
  console.error(`[${context}] Error:`, errorInfo);
  
  // Log non-sensitive context if provided
  if (sensitiveData) {
    const sanitized = Object.keys(sensitiveData).reduce((acc, key) => {
      // Mask sensitive fields
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('key')) {
        acc[key] = '***REDACTED***';
      } else {
        acc[key] = sensitiveData[key];
      }
      return acc;
    }, {} as Record<string, any>);
    
    console.error(`[${context}] Context:`, JSON.stringify(sanitized));
  }
}
