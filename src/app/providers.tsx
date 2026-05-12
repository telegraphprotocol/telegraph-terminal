"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet/wallet-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </WalletProvider>
  );
}
