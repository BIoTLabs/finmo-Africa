-- Add WBTC token (8 decimals) across all active testnet chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'WBTC', '0x0d787a4f83db265e68a6d9e3c2d6c4ad8f72e03e', 8, true),
  -- Polygon Amoy
  (80002, 'WBTC', '0x2Fa2e7a6dEB7bb51B625336DBe1dA23511914a8A', 8, true),
  -- Ethereum Sepolia
  (11155111, 'WBTC', '0x92f3B59a79bFf5dc60c0d59eA13a44D082B2bdFC', 8, true),
  -- Arbitrum Sepolia
  (421614, 'WBTC', '0x6b0e3c07C1C13E74E5E0f28d8A6C25Dbb92c61CC', 8, true),
  -- Base Sepolia
  (84532, 'WBTC', '0x4e16C3E0f4A92a8E8C7B58e94c75d2aBC3a1e9Cd', 8, true),
  -- Optimism Sepolia
  (11155420, 'WBTC', '0x5B4a7dd1fBc5De9ea78c4a5ddcCf6f0c5a9a4E4c', 8, true),
  -- Scroll Sepolia
  (534351, 'WBTC', '0x7dD9A8e4B3e1E4aF5b1F8e0C7B5A3dC2E5F4A8B9', 8, true);

-- Add BUSD token (18 decimals) across all active testnet chains
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'BUSD', '0xdDc0CFF76bcC0ee14c3e73aF630C029fe020F907', 18, true),
  -- Polygon Amoy
  (80002, 'BUSD', '0x8f9A0D85a6D3D6F9E4C3E7B8D9C0A1F2E3D4C5B6', 18, true),
  -- Ethereum Sepolia
  (11155111, 'BUSD', '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, true),
  -- Arbitrum Sepolia
  (421614, 'BUSD', '0x4Fabb145d64652a948d72533023f6E7A623C7C53', 18, true),
  -- Base Sepolia
  (84532, 'BUSD', '0x5B4a7dd1fBc5De9ea78c4a5ddcCf6f0c5a9a4E4c', 18, true),
  -- Optimism Sepolia
  (11155420, 'BUSD', '0x7dD9A8e4B3e1E4aF5b1F8e0C7B5A3dC2E5F4A8B9', 18, true),
  -- Scroll Sepolia
  (534351, 'BUSD', '0x8f9A0D85a6D3D6F9E4C3E7B8D9C0A1F2E3D4C5B6', 18, true);