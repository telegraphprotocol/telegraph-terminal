"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DaemonResultItem } from "@/lib/engine-daemon-types";
import { summarizeExecutionResult } from "@/lib/kraken-signal-result";

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
    <div className="flex flex-col gap-4 w-full rounded-3xl bg-card border border-border/50 p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white tracking-tight">Live Alpha Alerts</h3>
          <Info size={14} className="text-muted-foreground" />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 text-[11px] font-medium text-white/70 hover:bg-muted transition-colors border border-border/30">
          Recent <ChevronDown size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && alerts.length === 0 && (
          <div className="px-2 py-6 text-sm text-muted-foreground">Loading top alerts...</div>
        )}
        {!loading && alerts.length === 0 && (
          <div className="px-2 py-6 text-sm text-muted-foreground">No high-interest alerts found.</div>
        )}
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl bg-background/30 border border-border/50 overflow-hidden group hover:border-primary/30 transition-all"
          >
            <div className="p-5 flex flex-col gap-3">
              <div>
                <h4 className="text-[15px] font-bold text-white mb-1 group-hover:text-primary transition-colors">
                  {alert.question.text || "Untitled signal"}
                </h4>
                <div className={cn(
                  "text-[12px] font-semibold",
                  alert.status === "error" ? "text-red-500" : "text-green-500"
                )}>
                  {buildSubtitle(alert)}
                </div>
              </div>
              
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {buildDescription(alert)}
              </p>
              
              <div className="flex flex-col gap-3 mt-1">
                <button className="flex items-center justify-between px-4 h-9 rounded-xl bg-secondary text-white text-[12px] font-bold border border-primary/20 hover:bg-primary transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-primary group-hover:text-white">✦</span>
                    Action:
                  </div>
                  <span>{alert.question.category || "OTHER"}</span>
                </button>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck size={12} className="text-primary" />
                    {alert.routing.subnet_name || "Engine subnet"}
                  </div>
                  <div className="text-[11px] font-bold text-white bg-primary px-2 py-0.5 rounded-md">
                    ${alert.execution.cost_usd.toFixed(4)}
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

