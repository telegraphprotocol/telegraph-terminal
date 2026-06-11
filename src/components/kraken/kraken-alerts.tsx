"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DaemonResultItem } from "@/lib/engine-daemon-types";
import { KrakenSourceWithCopy } from "@/components/kraken/kraken-source-with-copy";
import { summarizeExecutionResult } from "@/lib/kraken-signal-result";
import { Skeleton } from "@/components/ui/skeleton";

interface KrakenAlertsProps {
  alerts: DaemonResultItem[];
  loading?: boolean;
}

function buildSubtitle(alert: DaemonResultItem) {
  if (alert.status === "error") {
    return `${alert.routing.error_stage || "execution"} failure`;
  }
  if (alert.question.interest_score >= 8) return "High Interest";
  if (alert.question.interest_score >= 6) return "Moderate Interest";
  return "Verified";
}

function buildDescription(alert: DaemonResultItem) {
  if (alert.execution.error) return alert.execution.error;
  const summary = summarizeExecutionResult(alert.execution.result);
  if (summary && !summary.startsWith("Structured subnet response")) return summary;
  return alert.routing.reasoning || "Signal enriched by engine routing.";
}

export function KrakenAlerts({ alerts, loading }: KrakenAlertsProps) {
  return (
    <div className="flex flex-col gap-4 w-full bg-card border border-border/60 p-4 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase">Live Alpha Alerts</h3>
          <Info size={13} className="text-muted-foreground" />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] bg-muted/30 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors border border-border/40 uppercase tracking-wider">
          Recent <ChevronDown size={11} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {loading && alerts.length === 0 && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 border border-border/40 p-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="ml-auto h-3 w-14" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <div className="px-2 py-6 text-sm text-muted-foreground font-mono">No high-interest alerts found.</div>
        )}
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-background/30 border border-border/40 overflow-hidden group hover:border-foreground/15 transition-all"
          >
            <div className="p-4 flex flex-col gap-3">
              <div>
                <h4 className="text-[13px] font-bold text-foreground mb-1 group-hover:text-foreground/90 transition-colors">
                  {alert.question.text || "Untitled signal"}
                </h4>
                <div className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider",
                  alert.status === "error" ? "text-red-500" : "text-green-500"
                )}>
                  {buildSubtitle(alert)}
                </div>
              </div>

              <p className="text-[12px] text-muted-foreground leading-relaxed font-mono">
                {buildDescription(alert)}
              </p>

              <div className="flex flex-col gap-2 mt-1">
                <button className="flex items-center justify-between px-3 h-8 bg-muted/40 text-foreground/70 text-[11px] font-bold border border-border/50 hover:bg-muted/60 hover:text-foreground transition-all uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/40">✦</span>
                    Action:
                  </div>
                  <span>{alert.question.category || "OTHER"}</span>
                </button>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <KrakenSourceWithCopy item={alert} variant="feed" />
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ShieldCheck size={12} className="text-muted-foreground shrink-0" />
                      <span className="max-w-[180px] truncate">{alert.routing.subnet_name || "Engine subnet"}</span>
                    </div>
                    <div className="text-[11px] font-bold text-foreground bg-muted px-2 py-0.5 whitespace-nowrap border border-border/50">
                      ${alert.execution.cost_usd.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
