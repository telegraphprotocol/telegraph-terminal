import { createConfig, http, injected } from "wagmi";
import { base, baseSepolia, polygon, type Chain } from "viem/chains";

function resolveTargetBaseChain(): Chain {
  const id = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (id === "84532" || process.env.NEXT_PUBLIC_USE_BASE_SEPOLIA === "true") {
    return baseSepolia;
  }
  return base;
}

export const targetBaseChain = resolveTargetBaseChain();

/** Extra chains so users can switch to Base Sepolia or Polygon for Telegraph x402 `accepts`. */
const x402ExtraChains: Chain[] = [baseSepolia, polygon, base].filter(
  (c) => c.id !== targetBaseChain.id,
);

export const wagmiChains = [targetBaseChain, ...x402ExtraChains] as [Chain, ...Chain[]];

const transports = Object.fromEntries(
  wagmiChains.map((c) => [c.id, http()] as const),
) as Record<number, ReturnType<typeof http>>;

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  transports,
  connectors: [injected()],
  ssr: true,
});
