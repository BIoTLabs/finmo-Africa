-- Phase 2: Add 7 additional tokens across all active testnet chains

-- Add UNI (Uniswap) - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'UNI', '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F', 18, true),
  -- Polygon Amoy
  (80002, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true),
  -- Ethereum Sepolia
  (11155111, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true),
  -- Arbitrum Sepolia
  (421614, 'UNI', '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 18, true),
  -- Base Sepolia
  (84532, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true),
  -- Optimism Sepolia
  (11155420, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true),
  -- Scroll Sepolia
  (534351, 'UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, true);

-- Add AAVE - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'AAVE', '0x5E8C8A7243651DB1384C0dDfDbC1bC56c3D37b91', 18, true),
  -- Polygon Amoy
  (80002, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true),
  -- Ethereum Sepolia
  (11155111, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true),
  -- Arbitrum Sepolia
  (421614, 'AAVE', '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196', 18, true),
  -- Base Sepolia
  (84532, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true),
  -- Optimism Sepolia
  (11155420, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true),
  -- Scroll Sepolia
  (534351, 'AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, true);

-- Add MKR (Maker) - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'MKR', '0x6f7C932e7684666C9fd1d44527765433e01fF61d', 18, true),
  -- Polygon Amoy
  (80002, 'MKR', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, true),
  -- Ethereum Sepolia
  (11155111, 'MKR', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, true),
  -- Arbitrum Sepolia
  (421614, 'MKR', '0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42', 18, true),
  -- Base Sepolia
  (84532, 'MKR', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, true),
  -- Optimism Sepolia
  (11155420, 'MKR', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, true),
  -- Scroll Sepolia
  (534351, 'MKR', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, true);

-- Add SHIB (Shiba Inu) - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'SHIB', '0x4F51185b6Dd3aDd6c5f1f6A08D5c8E6b31D4E5A8', 18, true),
  -- Polygon Amoy
  (80002, 'SHIB', '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 18, true),
  -- Ethereum Sepolia
  (11155111, 'SHIB', '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 18, true),
  -- Arbitrum Sepolia
  (421614, 'SHIB', '0x5033833c9fe8B9d3E09EEd2f73d2aaF7E3872fd1', 18, true),
  -- Base Sepolia
  (84532, 'SHIB', '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 18, true),
  -- Optimism Sepolia
  (11155420, 'SHIB', '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 18, true),
  -- Scroll Sepolia
  (534351, 'SHIB', '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 18, true);

-- Add APE (ApeCoin) - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'APE', '0xB7b31a6BC18e48888545CE79e83E06003bE70930', 18, true),
  -- Polygon Amoy
  (80002, 'APE', '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, true),
  -- Ethereum Sepolia
  (11155111, 'APE', '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, true),
  -- Arbitrum Sepolia
  (421614, 'APE', '0x74885b4D524d497261259B38900f54e6dbAd2210', 18, true),
  -- Base Sepolia
  (84532, 'APE', '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, true),
  -- Optimism Sepolia
  (11155420, 'APE', '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, true),
  -- Scroll Sepolia
  (534351, 'APE', '0x4d224452801ACEd8B2F0aebE155379bb5D594381', 18, true);

-- Add GRT (The Graph) - 18 decimals
INSERT INTO chain_tokens (chain_id, token_symbol, contract_address, decimals, is_active) VALUES
  -- Polygon Mumbai
  (80001, 'GRT', '0x5fe2B58c013d7601147DcdD68C143A77499f5531', 18, true),
  -- Polygon Amoy
  (80002, 'GRT', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, true),
  -- Ethereum Sepolia
  (11155111, 'GRT', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, true),
  -- Arbitrum Sepolia
  (421614, 'GRT', '0x23A941036Ae778Ac51Ab04CEa08Ed6e2FE103614', 18, true),
  -- Base Sepolia
  (84532, 'GRT', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, true),
  -- Optimism Sepolia
  (11155420, 'GRT', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, true),
  -- Scroll Sepolia
  (534351, 'GRT', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 18, true);