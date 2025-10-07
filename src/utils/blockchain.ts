import { ethers } from "ethers";

// Polygon Amoy Testnet configuration
export const POLYGON_AMOY = {
  chainId: 80002,
  name: "Polygon Amoy Testnet",
  rpcUrl: "https://rpc-amoy.polygon.technology",
  blockExplorer: "https://amoy.polygonscan.com",
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
};

// USDC contract on Polygon Amoy
export const USDC_CONTRACT = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

// Minimal ERC20 ABI for token transfers
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(POLYGON_AMOY.rpcUrl);
  }

  async getMaticBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Error getting MATIC balance:", error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error("Error getting token balance:", error);
      throw error;
    }
  }

  async estimateGas(to: string, value: string): Promise<string> {
    try {
      const gasEstimate = await this.provider.estimateGas({
        to,
        value: ethers.parseEther(value),
      });
      const gasPrice = await this.provider.getFeeData();
      const totalGas = gasEstimate * (gasPrice.gasPrice || BigInt(0));
      return ethers.formatEther(totalGas);
    } catch (error) {
      console.error("Error estimating gas:", error);
      return "0.002"; // Fallback estimate
    }
  }

  async getTransactionReceipt(txHash: string) {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      console.error("Error getting transaction receipt:", error);
      throw error;
    }
  }

  getExplorerUrl(txHash: string): string {
    return `${POLYGON_AMOY.blockExplorer}/tx/${txHash}`;
  }
}

export const blockchainService = new BlockchainService();
