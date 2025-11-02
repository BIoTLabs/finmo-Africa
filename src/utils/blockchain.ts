import { ethers } from "ethers";

// Supported mainnet chains configuration
export const SUPPORTED_CHAINS = {
  POLYGON: {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  ETHEREUM: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  ARBITRUM: {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  BASE: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

// Default chain (Polygon mainnet)
export const DEFAULT_CHAIN = SUPPORTED_CHAINS.POLYGON;

// Minimal ERC20 ABI for token transfers
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export class BlockchainService {
  private providers: Map<number, ethers.JsonRpcProvider>;

  constructor() {
    this.providers = new Map();
  }

  getProvider(chainId: number = DEFAULT_CHAIN.chainId): ethers.JsonRpcProvider {
    // Lazy initialization - only create provider when needed
    let provider = this.providers.get(chainId);
    if (!provider) {
      const chain = this.getChainConfig(chainId);
      provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      this.providers.set(chainId, provider);
    }
    return provider;
  }

  getChainConfig(chainId: number) {
    const chain = Object.values(SUPPORTED_CHAINS).find(c => c.chainId === chainId);
    if (!chain) {
      throw new Error(`Unsupported chain ${chainId}`);
    }
    return chain;
  }

  async getNativeBalance(address: string, chainId: number = DEFAULT_CHAIN.chainId): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`Error getting native balance on chain ${chainId}:`, error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string, chainId: number = DEFAULT_CHAIN.chainId): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error(`Error getting token balance on chain ${chainId}:`, error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async getMaticBalance(address: string): Promise<string> {
    return this.getNativeBalance(address, DEFAULT_CHAIN.chainId);
  }

  async estimateGas(to: string, value: string, chainId: number = DEFAULT_CHAIN.chainId): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      const gasEstimate = await provider.estimateGas({
        to,
        value: ethers.parseEther(value),
      });
      const gasPrice = await provider.getFeeData();
      const totalGas = gasEstimate * (gasPrice.gasPrice || BigInt(0));
      return ethers.formatEther(totalGas);
    } catch (error) {
      console.error(`Error estimating gas on chain ${chainId}:`, error);
      return "0.002"; // Fallback estimate
    }
  }

  async getTransactionReceipt(txHash: string, chainId: number = DEFAULT_CHAIN.chainId) {
    try {
      const provider = this.getProvider(chainId);
      return await provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error(`Error getting transaction receipt on chain ${chainId}:`, error);
      throw error;
    }
  }

  getExplorerUrl(txHash: string, chainId: number = DEFAULT_CHAIN.chainId): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.blockExplorer}/tx/${txHash}`;
  }
}

export const blockchainService = new BlockchainService();
