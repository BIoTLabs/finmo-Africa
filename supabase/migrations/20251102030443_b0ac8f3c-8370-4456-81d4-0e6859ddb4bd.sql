-- Phase 1: Deactivate testnet chains (archive, don't delete)
UPDATE supported_chains 
SET is_active = false 
WHERE is_testnet = true;

-- Phase 2: Remove testnet token configurations
DELETE FROM chain_tokens 
WHERE chain_id IN (80001, 80002, 11155111, 421614, 84532, 11155420, 534351);

-- Phase 3: Insert mainnet chains
INSERT INTO supported_chains (chain_id, chain_name, rpc_url, block_explorer, native_currency_symbol, native_currency_decimals, is_active, is_testnet) VALUES
  (137, 'Polygon', 'https://polygon-rpc.com', 'https://polygonscan.com', 'MATIC', 18, true, false),
  (1, 'Ethereum', 'https://eth.llamarpc.com', 'https://etherscan.io', 'ETH', 18, true, false),
  (42161, 'Arbitrum One', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', 'ETH', 18, true, false),
  (8453, 'Base', 'https://mainnet.base.org', 'https://basescan.org', 'ETH', 18, true, false);

-- Phase 4: Insert mainnet token contracts
-- USDC (6 decimals) on all 4 chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'USDC', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6, true),
  (1, 'USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, true),
  (42161, 'USDC', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, true),
  (8453, 'USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, true);

-- USDT (6 decimals) on Polygon, Ethereum, Arbitrum
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'USDT', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, true),
  (1, 'USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, true),
  (42161, 'USDT', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, true);

-- DAI (18 decimals) on all 4 chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'DAI', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 18, true),
  (1, 'DAI', '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, true),
  (42161, 'DAI', '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, true),
  (8453, 'DAI', '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 18, true);

-- WBTC (8 decimals) on all 4 chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'WBTC', '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', 8, true),
  (1, 'WBTC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, true),
  (42161, 'WBTC', '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8, true),
  (8453, 'WBTC', '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', 8, true);

-- WETH (18 decimals) on all 4 chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'WETH', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, true),
  (1, 'WETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, true),
  (42161, 'WETH', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, true),
  (8453, 'WETH', '0x4200000000000000000000000000000000000006', 18, true);

-- LINK (18 decimals) on all 4 chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'LINK', '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', 18, true),
  (1, 'LINK', '0x514910771AF9Ca656af840dff83E8264EcF986CA', 18, true),
  (42161, 'LINK', '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 18, true),
  (8453, 'LINK', '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196', 18, true);

-- UNI (18 decimals) on Polygon, Ethereum, Arbitrum
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'UNI', '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', 18, true),
  (1, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true),
  (42161, 'UNI', '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 18, true);

-- AAVE (18 decimals) on Polygon, Ethereum, Arbitrum
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  (137, 'AAVE', '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', 18, true),
  (1, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true),
  (42161, 'AAVE', '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196', 18, true);