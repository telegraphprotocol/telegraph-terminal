import { createConfig, http, injected } from "wagmi";
import { base, baseSepolia, type Chain } from "viem/chains";

function resolveTargetBaseChain(): Chain {
  const id = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (id === "84532" || process.env.NEXT_PUBLIC_USE_BASE_SEPOLIA === "true") {
    return baseSepolia;
  }
  return base;
}

export const targetBaseChain = resolveTargetBaseChain();

export const wagmiConfig = createConfig({
  chains: [targetBaseChain],
  transports: {
    [targetBaseChain.id]: http(),
  },
  connectors: [injected()],
  ssr: true,
});
