import { ethers } from "ethers";

// Supported testnet chains configuration
export const SUPPORTED_CHAINS = {
  POLYGON_MUMBAI: {
    chainId: 80001,
    name: "Polygon Mumbai",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorer: "https://mumbai.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  POLYGON_AMOY: {
    chainId: 80002,
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    blockExplorer: "https://amoy.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
  ARBITRUM_SEPOLIA: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  OPTIMISM_SEPOLIA: {
    chainId: 11155420,
    name: "Optimism Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    blockExplorer: "https://sepolia-optimism.etherscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  BASE_SEPOLIA: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  SCROLL_SEPOLIA: {
    chainId: 534351,
    name: "Scroll Sepolia",
    rpcUrl: "https://sepolia-rpc.scroll.io",
    blockExplorer: "https://sepolia.scrollscan.com",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
  SEPOLIA: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

// Default chain (Polygon Mumbai)
export const DEFAULT_CHAIN = SUPPORTED_CHAINS.POLYGON_MUMBAI;

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
    // Initialize providers for all supported chains
    Object.values(SUPPORTED_CHAINS).forEach(chain => {
      this.providers.set(chain.chainId, new ethers.JsonRpcProvider(chain.rpcUrl));
    });
  }

  getProvider(chainId: number = DEFAULT_CHAIN.chainId): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`No provider configured for chain ${chainId}`);
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
