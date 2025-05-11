import React, { useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { Wallet, ConnectWallet as OnchainConnectWallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Identity, Avatar, Name, Address, EthBalance } from "@coinbase/onchainkit/identity";
import { useAccount, useDisconnect, useBalance } from "wagmi";
import { useNavigate } from "react-router-dom";
import { displayToast } from "@/lib/utils";

const ConnectWallet = () => {
  const { isAuthenticated, setUser, disconnectUser, connectUser } = useApp();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { data: balanceData } = useBalance({
    address: address,
  });

  // Handle wallet connection
  const handleWalletConnection = useCallback(async () => {
    if (isConnected && address) {
      try {
        // Call your existing connectUser function which handles profile creation
        await connectUser();
        
        // Force a navigation to refresh the UI
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Error during wallet connection:", error);
        displayToast("Connection Error", "Failed to connect wallet", "error");
      }
    }
  }, [isConnected, address, connectUser, navigate]);

  // Handle wallet disconnection
  const handleDisconnect = useCallback(() => {
    // First disconnect the wallet using wagmi
    disconnect();
    // Then update app state
    disconnectUser();
    // Navigate to home page
    navigate("/", { replace: true });
  }, [disconnect, disconnectUser, navigate]);

  // Listen for wallet connection
  useEffect(() => {
    if (isConnected && address && !isAuthenticated) {
      handleWalletConnection();
    }
  }, [isConnected, address, isAuthenticated, handleWalletConnection]);

  // Listen for wallet disconnection
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      disconnectUser();
      navigate("/", { replace: true });
    }
  }, [isConnected, isAuthenticated, disconnectUser, navigate]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <Wallet>
      <OnchainConnectWallet 
        className="bg-base-gradient hover:opacity-90 text-white px-4 py-2 rounded-md"
        disconnectedLabel="Connect Wallet"
        onConnect={handleWalletConnection}
      >
        <Avatar className="h-5 w-5 mr-2" />
        <Name />
      </OnchainConnectWallet>
      <WalletDropdown>
        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
          <Avatar />
          <Name />
          <Address />
          <EthBalance />
        </Identity>
        <div onClick={handleDisconnect}>
          <WalletDropdownDisconnect />
        </div>
      </WalletDropdown>
    </Wallet>
  );
};

// Export the component
export default ConnectWallet;
