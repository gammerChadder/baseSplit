import { ethers } from "ethers";
import { displayToast } from "./utils";

export const SEPOLIA_CHAIN_ID = '0x14a34'; // Hex value for base Sepolia testnet (84532 in decimal)
export const SEPOLIA_RPC_URL = 'https://84532.rpc.thirdweb.com';
export const BLOCK_EXPLORER_URL = 'https://base-sepolia.blockscout.com';

// USDC contract address on Base Sepolia testnet
export const USDC_CONTRACT_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Example address, replace with actual testnet USDC address
export const USDC_CONTRACT_ABI = [
  // ERC20 Standard functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export async function requestAccount() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    
    return accounts[0];
  } catch (error) {
    console.error("Error connecting to MetaMask:", error);
    throw error;
  }
}

export async function switchToSepoliaNetwork() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    try {
      // Try to switch to the Base Sepolia network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // This error code means the chain hasn't been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Base Sepolia Testnet',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: [BLOCK_EXPLORER_URL]
              },
            ],
          });
        } catch (addError) {
          throw addError;
        }
      }
      throw switchError;
    }
    
    return true;
  } catch (error) {
    console.error("Error switching to Base Sepolia network:", error);
    throw error;
  }
}

export async function getBalance(address: string) {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const balance = await provider.getBalance(address);
    
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error("Error getting balance:", error);
    throw error;
  }
}

export async function getUsdcBalance(address: string) {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      USDC_CONTRACT_ABI,
      provider
    );
    
    const decimals = await usdcContract.decimals();
    const balance = await usdcContract.balanceOf(address);
    
    return ethers.utils.formatUnits(balance, decimals);
  } catch (error) {
    console.error("Error getting USDC balance:", error);
    throw error;
  }
}

export async function sendTransaction(to: string, amount: string) {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    // Ensure on the correct network
    await switchToSepoliaNetwork();
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Convert amount to Wei
    const amountWei = ethers.utils.parseEther(amount);
    
    // Create transaction object
    const tx = {
      to,
      value: amountWei,
    };
    
    // Send transaction
    const transaction = await signer.sendTransaction(tx);
    
    // Wait for transaction to be mined
    displayToast("Transaction Sent", "Waiting for confirmation...", "info");
    const receipt = await transaction.wait();
    
    return receipt.transactionHash;
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
}

export async function sendUsdcTransaction(to: string, amount: string) {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    // Ensure on the correct network
    await switchToSepoliaNetwork();
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Get USDC contract
    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      USDC_CONTRACT_ABI,
      signer
    );
    
    // Get decimals
    const decimals = await usdcContract.decimals();
    
    // Convert amount to USDC units
    const amountInUsdcUnits = ethers.utils.parseUnits(amount, decimals);
    
    // Send USDC transaction
    displayToast("USDC Transaction", "Waiting for confirmation...", "info");
    const transaction = await usdcContract.transfer(to, amountInUsdcUnits);
    
    // Wait for transaction to be mined
    const receipt = await transaction.wait();
    
    return receipt.transactionHash;
  } catch (error) {
    console.error("Error sending USDC transaction:", error);
    throw error;
  }
}

export async function connectWallet() {
  try {
    if (!window.ethereum) {
      displayToast("Wallet Connection Failed", "Please install MetaMask to use this application.", "error");
      throw new Error("MetaMask is not installed!");
    }
    
    await switchToSepoliaNetwork();
    const address = await requestAccount();
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const balance = await getBalance(address);
    const usdcBalance = await getUsdcBalance(address);
    
    return { address, balance, usdcBalance };
  } catch (error) {
    console.error("Error connecting wallet:", error);
    displayToast("Wallet Connection Failed", "Please check your MetaMask extension and try again.", "error");
    throw error;
  }
}

export async function getGasPrice() {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const gasPrice = await provider.getGasPrice();
    
    return ethers.utils.formatUnits(gasPrice, 'gwei');
  } catch (error) {
    console.error("Error getting gas price:", error);
    throw error;
  }
}
