/**
 * Utility to detect Private Network Access blocking
 * Chrome's PNA feature can block requests when users are on wireless networks
 */

export const detectPrivateNetworkBlock = (): boolean => {
  // Check if running in Chrome
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  
  if (!isChrome) return false;
  
  // Check connection type if available
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    const type = connection.effectiveType || connection.type;
    // If on wireless connection (wifi, cellular)
    if (type === 'wifi' || type === 'cellular' || type === '4g' || type === '3g') {
      return true;
    }
  }
  
  return false;
};

export const getBrowserAlternatives = (): string[] => {
  return ['Firefox', 'Safari', 'Microsoft Edge'];
};

export const getChromeBypassInstructions = (): string => {
  return 'Navigate to chrome://flags/#private-network-access-permission-prompt and set it to "Disabled"';
};
