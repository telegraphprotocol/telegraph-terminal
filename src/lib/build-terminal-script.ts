import type { TerminalLogEntry } from "@/lib/mock-data";

export type TerminalScriptReceipt = {
  subnet: string;
  subnetId: string;
  intent?: string;
  reasoning?: string;
};

export type TerminalScriptWallet = {
  address: string;
  usdcBalance?: string;
  chainId?: number;
};

export type TerminalScriptContext = {
  forcedSubnetId: string | null;
  engineSubnets: Array<{ id: string; label: string }>;
  coreWallet: TerminalScriptWallet | null;
  useTerminalBackend: boolean;
};

export type ServerLogLine = {
  label: string;
  detail: string;
  section: string;
};

type ScriptEntry = Omit<TerminalLogEntry, "time">;

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function entryKey(e: ScriptEntry): string {
  return `${e.section}|${e.label}|${e.detail.slice(0, 120)}`;
}

function dedupeEntries(entries: ScriptEntry[]): ScriptEntry[] {
  const seen = new Set<string>();
  const out: ScriptEntry[] = [];
  for (const e of entries) {
    const k = entryKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function subnetLabel(ctx: TerminalScriptContext): string | null {
  if (!ctx.forcedSubnetId) return null;
  return ctx.engineSubnets.find((s) => s.id === ctx.forcedSubnetId)?.label ?? `SN${ctx.forcedSubnetId}`;
}

export function buildPreflightScript(ctx: TerminalScriptContext): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  const picked = subnetLabel(ctx);

  if (picked) {
    entries.push({
      section: "Initial Routing",
      label: "ROUTING",
      detail: `Request targeted to ${picked} (SN${ctx.forcedSubnetId})`,
    });
  } else {
    entries.push({
      section: "Initial Routing",
      label: "ROUTING",
      detail: "Request broadcast — auto routing enabled",
    });
  }

  if (ctx.coreWallet?.address) {
    const bal =
      ctx.coreWallet.usdcBalance != null && ctx.coreWallet.usdcBalance !== ""
        ? ` · USDC ${ctx.coreWallet.usdcBalance}`
        : "";
    entries.push({
      section: "Initial Routing",
      label: "WALLET",
      detail: `Checking balance on Privy wallet (${truncateAddress(ctx.coreWallet.address)})${bal}`,
    });
  }

  entries.push({
    section: "Initial Routing",
    label: "STATUS",
    detail: ctx.useTerminalBackend
      ? "Terminal Backend Privy x402 channel ready"
      : "Engine WebSocket channel ready",
  });

  return entries;
}

function routingFromReceipt(receipt: TerminalScriptReceipt): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  const subnetLine = `${receipt.subnet} (SN${receipt.subnetId})`;

  entries.push({
    section: "Initial Routing",
    label: "ROUTED",
    detail: `Settled via ${subnetLine}`,
  });

  if (receipt.intent?.trim()) {
    entries.push({
      section: "Initial Routing",
      label: "INTENT",
      detail: receipt.intent.trim(),
    });
  }

  const reasoning = receipt.reasoning?.trim();
  if (reasoning) {
    entries.push({
      section: "Initial Routing",
      label: "REASONING",
      detail: reasoning,
    });
  }

  return entries;
}

function serverLogsToEntries(serverLogs: ServerLogLine[]): ScriptEntry[] {
  return serverLogs.map((l) => ({
    section: l.section?.trim() || "Payment & Rail",
    label: l.label,
    detail: l.detail,
  }));
}

/** Full script after HTTP/WS completes (deduped). */
export function buildPostResponseScript(
  serverLogs: ServerLogLine[],
  receipt: TerminalScriptReceipt | null | undefined,
  ctx: TerminalScriptContext,
  alreadyDisplayed?: ScriptEntry[],
): ScriptEntry[] {
  const preflight = buildPreflightScript(ctx);
  const routing = receipt ? routingFromReceipt(receipt) : [];
  const payment = serverLogsToEntries(serverLogs);

  const combined = dedupeEntries([...preflight, ...routing, ...payment]);

  if (!alreadyDisplayed?.length) return combined;

  const shown = new Set(alreadyDisplayed.map(entryKey));
  return combined.filter((e) => !shown.has(entryKey(e)));
}

/** Error path: preflight context + error lines from server or synthesized. */
export function buildErrorScript(
  serverLogs: ServerLogLine[],
  errorMessage: string,
  ctx: TerminalScriptContext,
  alreadyDisplayed?: ScriptEntry[],
): ScriptEntry[] {
  const payment =
    serverLogs.length > 0
      ? serverLogsToEntries(serverLogs)
      : [
          {
            section: "Payment & Rail",
            label: "ERROR",
            detail: errorMessage,
          },
        ];

  const combined = dedupeEntries([...buildPreflightScript(ctx), ...payment]);
  if (!alreadyDisplayed?.length) return combined;

  const shown = new Set(alreadyDisplayed.map(entryKey));
  return combined.filter((e) => !shown.has(entryKey(e)));
}

/** Filter script entries against logs already on screen (no time field). */
export function scriptEntriesFromDisplayedLogs(
  logs: TerminalLogEntry[],
): ScriptEntry[] {
  return logs.map(({ section, label, detail }) => ({ section, label, detail }));
}
