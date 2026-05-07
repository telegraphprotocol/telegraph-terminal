"use client";

import { motion } from "framer-motion";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

const data = [
  { name: "Apr 4", internal: 400, kraken: 40 },
  { name: "Apr 9", internal: 300, kraken: 30 },
  { name: "Apr 15", internal: 500, kraken: 50 },
  { name: "Apr 21", internal: 450, kraken: 45 },
  { name: "Apr 27", internal: 600, kraken: 60 },
  { name: "May 3", internal: 550, kraken: 55 },
  { name: "May 9", internal: 480, kraken: 48 },
  { name: "May 15", internal: 700, kraken: 70 },
  { name: "May 21", internal: 650, kraken: 65 },
  { name: "May 27", internal: 590, kraken: 59 },
  { name: "Jun 2", internal: 750, kraken: 75 },
  { name: "Jun 7", internal: 800, kraken: 80 },
  { name: "Jun 12", internal: 720, kraken: 72 },
  { name: "Jun 18", internal: 850, kraken: 85 },
  { name: "Jun 24", internal: 900, kraken: 90 },
  { name: "Jun 30", internal: 950, kraken: 95 },
];

export function KrakenAnalytics() {
  return (
    <div className="w-full bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Cost Efficiency Comparison</h3>
          <p className="text-sm text-muted-foreground">In-House Model Training vs. Kraken Signal API</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-sm text-muted-foreground">Total Internal AI Cost</span>
            </div>
            <span className="text-sm font-medium text-white">$XXX</span>
          </div>
          <div className="flex items-center justify-between gap-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Total Kraken Signal API Cost</span>
            </div>
            <span className="text-sm font-medium text-white">$XXX</span>
          </div>
        </div>
      </div>

      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              dy={10}
            />
            <YAxis hide />
            <Tooltip 
              cursor={{ fill: "rgba(122, 46, 255, 0.05)" }}
              contentStyle={{ 
                backgroundColor: "var(--card)", 
                border: "1px solid var(--border)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#fff"
              }}
            />
            <Bar dataKey="internal" radius={[4, 4, 0, 0]} barSize={12}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--secondary)" />
              ))}
            </Bar>
            <Bar dataKey="kraken" radius={[4, 4, 0, 0]} barSize={12}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--primary)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
