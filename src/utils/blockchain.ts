import { ethers } from "ethers";

// Supported L2 chains configuration
export const SUPPORTED_CHAINS = {
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
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
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
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

// Default chain (Polygon Amoy)
export const POLYGON_AMOY = SUPPORTED_CHAINS.POLYGON_AMOY;
export const USDC_CONTRACT = POLYGON_AMOY.usdc;

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

  getProvider(chainId: number = POLYGON_AMOY.chainId): ethers.JsonRpcProvider {
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

  async getNativeBalance(address: string, chainId: number = POLYGON_AMOY.chainId): Promise<string> {
    try {
      const provider = this.getProvider(chainId);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`Error getting native balance on chain ${chainId}:`, error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string, chainId: number = POLYGON_AMOY.chainId): Promise<string> {
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
    return this.getNativeBalance(address, POLYGON_AMOY.chainId);
  }

  async estimateGas(to: string, value: string, chainId: number = POLYGON_AMOY.chainId): Promise<string> {
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

  async getTransactionReceipt(txHash: string, chainId: number = POLYGON_AMOY.chainId) {
    try {
      const provider = this.getProvider(chainId);
      return await provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error(`Error getting transaction receipt on chain ${chainId}:`, error);
      throw error;
    }
  }

  getExplorerUrl(txHash: string, chainId: number = POLYGON_AMOY.chainId): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.blockExplorer}/tx/${txHash}`;
  }
}

export const blockchainService = new BlockchainService();
