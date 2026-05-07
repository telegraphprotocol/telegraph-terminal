"use client";

import { motion } from "framer-motion";
import { PlayCircle, CloudDrizzle, Link2 } from "lucide-react";

const protocols = [
  {
    id: "media",
    title: "Media Authenticity",
    description: "Real-time verification of viral media using ensemble deepfake detection subnets.",
    icon: PlayCircle,
    price: "$0.01 per Signal",
  },
  {
    id: "weather",
    title: "Weather Risk",
    description: "Low-latency macro forecasting for supply chain routing and energy grid bidding.",
    icon: CloudDrizzle,
    price: "$0.01 per Signal",
  },
  {
    id: "supply",
    title: "Supply Chain Vision",
    description: "Computer vision anomaly detection for crop yields and port congestion.",
    icon: Link2,
    price: "$0.01 per Signal",
  },
];

export function KrakenSkillCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {protocols.map((protocol, i) => (
        <motion.div
          key={protocol.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-6 bg-card rounded-xl border border-border/50 hover:border-primary/40 transition-all group"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <protocol.icon size={28} />
            </div>
            <div className="px-3 py-1 rounded-lg bg-primary text-white text-[12px] font-bold shadow-lg shadow-primary/20">
              {protocol.price}
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
            {protocol.title}
          </h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
            {protocol.description}
          </p>
          
          <button className="w-full h-10 rounded-xl bg-muted/50 text-white text-sm font-medium hover:bg-muted transition-colors border border-border/50">
            Plug-in to Kraken API
          </button>
        </motion.div>
      ))}
    </div>
  );
}
