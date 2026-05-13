import { UserRejectedRequestError } from "viem";
import type { WalletClient } from "viem";
import { wagmiChainById } from "@/lib/wagmi-config";

/**
 * EIP-1193 / wallet: chain is not in the wallet yet (`wallet_switchEthereumChain` rejected).
 */
export function isChainNotConfiguredError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? Number((error as { code: number }).code)
      : undefined;
  if (code === 4902) return true;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /4902|chain not added|unrecognized chain|Unrecognized chain|not been added|Chain not configured/i.test(
    msg,
  );
}

/**
 * Switch the wallet to `targetChainId`. If the wallet does not know the chain (4902 / equivalent),
 * calls `wallet_addEthereumChain` via viem `addChain`, then retries the switch once.
 */
export async function ensureOnTargetChain(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  targetChainId: number,
  walletClient?: WalletClient | null,
): Promise<void> {
  try {
    await switchChainAsync({ chainId: targetChainId });
    return;
  } catch (err) {
    if (isUserRejectedChainError(err)) throw err;
    if (!walletClient || !isChainNotConfiguredError(err)) throw err;
    const chain = wagmiChainById(targetChainId);
    if (!chain) throw err;
    await walletClient.addChain({ chain });
    await switchChainAsync({ chainId: targetChainId });
  }
}

export function isUserRejectedChainError(error: unknown): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: number }).code === UserRejectedRequestError.code
  ) {
    return true;
  }
  return false;
}

export function formatWalletError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Try again.";
}
