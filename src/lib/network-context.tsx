"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type PaymentNetwork = "solana" | "base-sepolia";

export const PAYMENT_NETWORKS: { value: PaymentNetwork; label: string; short: string }[] = [
  { value: "solana", label: "Solana Devnet", short: "SOL" },
  { value: "base-sepolia", label: "Base Sepolia", short: "BASE" },
];

const STORAGE_KEY = "tg_payment_network";

function readStoredNetwork(): PaymentNetwork {
  if (typeof window === "undefined") return "base-sepolia";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "solana" || stored === "base-sepolia" ? stored : "base-sepolia";
}

interface NetworkContextValue {
  network: PaymentNetwork;
  setNetwork: (n: PaymentNetwork) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: "base-sepolia",
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<PaymentNetwork>("base-sepolia");

  useEffect(() => {
    setNetworkState(readStoredNetwork());
  }, []);

  const setNetwork = useCallback((n: PaymentNetwork) => {
    localStorage.setItem(STORAGE_KEY, n);
    setNetworkState(n);
  }, []);

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function usePaymentNetwork() {
  return useContext(NetworkContext);
}
