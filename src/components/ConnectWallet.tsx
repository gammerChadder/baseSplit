
import React from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ConnectWallet = () => {
  const { connectUser, isLoading, isAuthenticated } = useApp();

  if (isAuthenticated) {
    return null;
  }

  return (
    <Button
      onClick={connectUser}
      disabled={isLoading}
      className="bg-base-gradient hover:opacity-90 text-white"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  );
};

export default ConnectWallet;
