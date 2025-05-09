
import { ethers } from "ethers";
import { displayToast } from "./utils";

export const SEPOLIA_CHAIN_ID = '0x14a34'; // Hex value for base Sepolia testnet (84532 in decimal)
export const SEPOLIA_RPC_URL = 'https://84532.rpc.thirdweb.com';
export const BLOCK_EXPLORER_URL = 'https://base-sepolia.blockscout.com';

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
    
    return { address, balance };
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
