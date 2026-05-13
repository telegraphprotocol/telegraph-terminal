import { createConfig, http, injected } from "wagmi";
import { base, baseSepolia, polygon, type Chain } from "viem/chains";

/** Map known Telegraph x402 rail ids to viem chains (primary wagmi chain). */
function chainFromNumericEnv(value: string | undefined): Chain | null {
  const id = value?.trim();
  if (!id) return null;
  if (id === "84532") return baseSepolia;
  if (id === "8453") return base;
  if (id === "137") return polygon;
  return null;
}

/**
 * Default chain for wagmi (connect + UI). Precedence:
 * 1. `NEXT_PUBLIC_CHAIN_ID` — explicit primary (84532 / 8453 / 137).
 * 2. `NEXT_PUBLIC_USE_BASE_SEPOLIA=true` — Base Sepolia.
 * 3. `NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID` — align primary with x402 rail when unset above (avoids Base mainnet default while x402 targets Sepolia).
 * 4. Base mainnet.
 */
function resolveTargetBaseChain(): Chain {
  const explicit = chainFromNumericEnv(process.env.NEXT_PUBLIC_CHAIN_ID);
  if (explicit) return explicit;

  if (process.env.NEXT_PUBLIC_USE_BASE_SEPOLIA === "true") {
    return baseSepolia;
  }

  const fromX402 = chainFromNumericEnv(process.env.NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID);
  if (fromX402) return fromX402;

  return base;
}

export const targetBaseChain = resolveTargetBaseChain();

/** Extra chains so users can switch to Base Sepolia or Polygon for Telegraph x402 `accepts`. */
const x402ExtraChains: Chain[] = [baseSepolia, polygon, base].filter(
  (c) => c.id !== targetBaseChain.id,
);

export const wagmiChains = [targetBaseChain, ...x402ExtraChains] as [Chain, ...Chain[]];

/** Resolve a registered wagmi/viem chain by id (for `wallet_addEthereumChain` metadata). */
export function wagmiChainById(chainId: number): Chain | undefined {
  return wagmiChains.find((c) => c.id === chainId);
}

const transports = Object.fromEntries(
  wagmiChains.map((c) => [c.id, http()] as const),
) as Record<number, ReturnType<typeof http>>;

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  transports,
  connectors: [injected()],
  ssr: true,
});
