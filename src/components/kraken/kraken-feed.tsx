"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, Copy, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  skill: string;
  inputSnippet: string | React.ReactNode;
  status: "synthetic" | "normal" | "yield_anomaly" | "severe_alert" | "authentic" | "verified";
  cost: string;
  wallet: string;
}

const statusConfig = {
  synthetic: { label: "Synthetic", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertCircle },
  normal: { label: "Normal", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  authentic: { label: "Authentic", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  verified: { label: "Verified", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  yield_anomaly: { label: "Yield Anomaly", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertCircle },
  severe_alert: { label: "Severe Alert", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertCircle },
};

const logs: LogEntry[] = [
  { timestamp: "14:02:31", skill: "DEEPFAKE-DETECTION", inputSnippet: "Ayumi_frame_01.jpg", status: "synthetic", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:02:32", skill: "WEATHER-RISK", inputSnippet: "Future_Radar.png", status: "normal", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:02:33", skill: "CV-COMMODITY-YIELD", inputSnippet: "Lat: 16.50, Lon: -0.69", status: "yield_anomaly", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:02:37", skill: "DEEPFAKE-DETECTION", inputSnippet: "Mobilization_04.mp4", status: "authentic", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:02:41", skill: "WEATHER-RISK", inputSnippet: "Port_Disruption.png", status: "normal", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:02:57", skill: "CV-COMMODITY-YIELD", inputSnippet: "Lat: 16.50, Lon: -0.69", status: "normal", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:03:01", skill: "DEEPFAKE-DETECTION", inputSnippet: "Synthetic_Audio.mp3", status: "synthetic", cost: "$0.01", wallet: "0X4A...9B2" },
  { timestamp: "14:03:12", skill: "WEATHER-RISK", inputSnippet: "Category_4_Storm", status: "severe_alert", cost: "$0.01", wallet: "0X4A...9B2" },
];

export function KrakenFeed() {
  return (
    <div className="w-full bg-card rounded-3xl overflow-hidden border border-border/50">
      <div className="grid grid-cols-[110px_1fr_150px_130px_90px_130px_60px] gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
        {["TIMESTAMP", "SKILL USED", "INPUT SNIPPET", "STATUS", "FIXED COST", "BUYER WALLET", "PROOF"].map((header) => (
          <div key={header} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {header}
          </div>
        ))}
      </div>
      
      <div className="divide-y divide-border/30">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-[110px_1fr_150px_130px_90px_130px_60px] gap-3 px-4 py-3 items-center hover:bg-muted/10 transition-colors"
          >
            <div className="text-xs font-medium text-white/70 tabular-nums">{log.timestamp}</div>
            <div className="text-[12px] font-semibold text-white tracking-tight truncate">{log.skill}</div>
            <div className="text-[10px] text-muted-foreground truncate font-mono">
              {log.inputSnippet}
            </div>
            <div>
              {statusConfig[log.status] && (
                (() => {
                  const StatusIcon = statusConfig[log.status].icon;
                  return (
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                  statusConfig[log.status].color
                )}>
                  <StatusIcon size={10} />
                  {statusConfig[log.status].label}
                </div>
                  );
                })()
              )}
            </div>
            <div>
              <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold shadow-lg shadow-primary/20">
                {log.cost}
              </div>
            </div>
            <div className="flex items-center gap-2 group">
              <span className="text-[12px] text-white/90 font-mono tracking-tighter">{log.wallet}</span>
              <Copy size={12} className="text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" />
            </div>
            <div className="flex justify-center">
              <ReceiptText size={16} className="text-muted-foreground hover:text-white cursor-pointer transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
