/**
 * Single source of truth for user-facing wallet naming. Internal API/DB values
 * (`walletMode: "privy" | "external"`) stay unchanged — this is purely a
 * display layer so copy can be tuned in one place.
 */
export const INSTANT_WALLET_LABEL = "Instant Wallet";
export const CONNECTED_WALLET_LABEL = "Connected Wallet";

export function walletModeLabel(mode: "privy" | "external" | null | undefined): string {
  return mode === "privy" ? INSTANT_WALLET_LABEL : CONNECTED_WALLET_LABEL;
}
