"use client";

import { motion } from "framer-motion";
import { AlertCircle, ShieldCheck, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alerts = [
  {
    id: 1,
    title: "Media Authenticity: Conflict Update",
    subtitle: "99% Deepfake Confirmed",
    description: "Viral video of official announcing military mobilization flagged as synthetic audio/video.",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400",
    action: "Ignore market panic",
    verified: true,
  },
  {
    id: 2,
    title: "Weather Risk: Port Disruption",
    subtitle: "Severe Alert",
    description: "Category 4 storm trajectory confirmed. High probability of supply chain disruption.",
    image: "https://images.unsplash.com/photo-1527489377706-5bf97e608852?auto=format&fit=crop&q=80&w=400",
    action: "Reroute shipments",
    verified: true,
  },
  {
    id: 3,
    title: "Supply Chain Vision: Crop Yield",
    subtitle: "Verified",
    description: "Satellite computer vision confirms stable crop yields in monitored regions. No anomaly detected.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=400",
    action: "View data points",
    verified: true,
  },
];

export function KrakenAlerts() {
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
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl bg-background/30 border border-border/50 overflow-hidden group hover:border-primary/30 transition-all"
          >
            <div className="relative h-40 overflow-hidden">
              <img 
                src={alert.image} 
                alt={alert.title}
                className="w-full h-full object-cover grayscale-[20%] group-hover:scale-110 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
            </div>
            
            <div className="p-5 flex flex-col gap-3">
              <div>
                <h4 className="text-[15px] font-bold text-white mb-1 group-hover:text-primary transition-colors">
                  {alert.title}
                </h4>
                <div className={cn(
                  "text-[12px] font-semibold",
                  alert.subtitle.includes("Alert") || alert.subtitle.includes("Deepfake") ? "text-red-500" : "text-green-500"
                )}>
                  {alert.subtitle}
                </div>
              </div>
              
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {alert.description}
              </p>
              
              <div className="flex flex-col gap-3 mt-1">
                <button className="flex items-center justify-between px-4 h-9 rounded-xl bg-secondary text-white text-[12px] font-bold border border-primary/20 hover:bg-primary transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-primary group-hover:text-white">✦</span>
                    Action:
                  </div>
                  <span>{alert.action}</span>
                </button>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck size={12} className="text-primary" />
                    Verified via Kraken Node
                  </div>
                  <div className="text-[11px] font-bold text-white bg-primary px-2 py-0.5 rounded-md">
                    $0.01
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

