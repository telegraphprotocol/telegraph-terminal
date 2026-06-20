"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import { NetworkProvider } from "@/lib/network-context";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const SOLANA_ENDPOINT = clusterApiUrl("devnet");
const SOLANA_WALLETS = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={SOLANA_ENDPOINT}>
      <WalletProvider wallets={SOLANA_WALLETS} autoConnect>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: "var(--primary)",
                accentColorForeground: "var(--primary-foreground)",
                borderRadius: "medium",
              })}
            >
              <NetworkProvider>
                <ThemeProvider>{children}</ThemeProvider>
              </NetworkProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
