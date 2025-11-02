// Token information and icon mapping
export const TOKEN_INFO: Record<string, { name: string; icon: string; category: string }> = {
  // Stablecoins
  USDC: { name: 'USD Coin', icon: '💵', category: 'Stablecoins' },
  USDT: { name: 'Tether', icon: '💵', category: 'Stablecoins' },
  DAI: { name: 'Dai', icon: '💵', category: 'Stablecoins' },
  BUSD: { name: 'Binance USD', icon: '💵', category: 'Stablecoins' },
  
  // Wrapped Assets
  WBTC: { name: 'Wrapped Bitcoin', icon: '₿', category: 'Wrapped Assets' },
  WETH: { name: 'Wrapped Ether', icon: 'Ξ', category: 'Wrapped Assets' },
  
  // DeFi Tokens
  LINK: { name: 'Chainlink', icon: '🔗', category: 'DeFi' },
  UNI: { name: 'Uniswap', icon: '🦄', category: 'DeFi' },
  AAVE: { name: 'Aave', icon: '👻', category: 'DeFi' },
  MKR: { name: 'Maker', icon: 'Ⓜ️', category: 'DeFi' },
  
  // Memecoins
  SHIB: { name: 'Shiba Inu', icon: '🐕', category: 'Memecoins' },
  APE: { name: 'ApeCoin', icon: '🦍', category: 'Memecoins' },
  
  // Infrastructure
  GRT: { name: 'The Graph', icon: '📊', category: 'Infrastructure' },
  
  // Native Tokens
  MATIC: { name: 'Polygon', icon: '⬡', category: 'Native' },
  ETH: { name: 'Ethereum', icon: 'Ξ', category: 'Native' },
};

export const getTokenInfo = (symbol: string) => {
  return TOKEN_INFO[symbol] || { name: symbol, icon: '🪙', category: 'Other' };
};

export const groupTokensByCategory = (tokens: Array<{ token: string; balance: number }>) => {
  const grouped: Record<string, Array<{ token: string; balance: number }>> = {};
  
  tokens.forEach((tokenData) => {
    const info = getTokenInfo(tokenData.token);
    if (!grouped[info.category]) {
      grouped[info.category] = [];
    }
    grouped[info.category].push(tokenData);
  });
  
  return grouped;
};
