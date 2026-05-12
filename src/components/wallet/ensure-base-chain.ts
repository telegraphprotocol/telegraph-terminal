import { UserRejectedRequestError } from "viem";

/**
 * Switch the active wallet to the configured Base chain. The injected connector
 * (MetaMask, Trust, etc.) already handles EIP-1193 error 4902 by calling
 * `wallet_addEthereumChain` then completing the switch — no duplicate logic here.
 */
export async function ensureOnTargetChain(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  targetChainId: number,
): Promise<void> {
  await switchChainAsync({ chainId: targetChainId });
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
