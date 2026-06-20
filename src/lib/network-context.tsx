"use client";

import { createContext, useContext, useState } from "react";

export type PaymentNetwork = "solana" | "base-sepolia";

export const PAYMENT_NETWORKS: { value: PaymentNetwork; label: string; short: string }[] = [
  { value: "solana", label: "Solana Devnet", short: "SOL" },
  { value: "base-sepolia", label: "Base Sepolia", short: "BASE" },
];

const DEFAULT_NETWORK: PaymentNetwork =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as PaymentNetwork | undefined) === "base-sepolia"
    ? "base-sepolia"
    : "solana";

interface NetworkContextValue {
  network: PaymentNetwork;
  setNetwork: (n: PaymentNetwork) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: DEFAULT_NETWORK,
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<PaymentNetwork>(DEFAULT_NETWORK);
  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function usePaymentNetwork() {
  return useContext(NetworkContext);
}
