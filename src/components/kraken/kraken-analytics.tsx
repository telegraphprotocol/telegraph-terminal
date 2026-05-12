"use client";

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
import { useMemo } from "react";
import { DaemonResultItem } from "@/lib/engine-daemon-types";

interface KrakenAnalyticsProps {
  items: DaemonResultItem[];
  loading?: boolean;
}

/** Fixed height avoids Recharts measuring `-1` when `%` height runs before flex layout settles. */
const CHART_HEIGHT_PX = 180;

export function KrakenAnalytics({ items, loading }: KrakenAnalyticsProps) {
  const totalDaemonCost = useMemo(
    () => items.reduce((sum, item) => sum + (item.execution.cost_usd || 0), 0),
    [items],
  );
  const totalInternalCost = useMemo(() => totalDaemonCost * 10, [totalDaemonCost]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, { name: string; internal: number; kraken: number }>();
    items.forEach((item) => {
      const day = new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const existing = grouped.get(day) || { name: day, internal: 0, kraken: 0 };
      existing.kraken += item.execution.cost_usd || 0;
      existing.internal += (item.execution.cost_usd || 0) * 10;
      grouped.set(day, existing);
    });
    return Array.from(grouped.values()).slice(-12);
  }, [items]);

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
            <span className="text-sm font-medium text-white">${totalInternalCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Total Kraken Signal API Cost</span>
            </div>
            <span className="text-sm font-medium text-white">${totalDaemonCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div
        className="w-full min-w-0 shrink-0"
        style={{ height: CHART_HEIGHT_PX }}
      >
        {loading && chartData.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: CHART_HEIGHT_PX }}
          >
            Loading analytics...
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX} minWidth={0}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--secondary)" />
              ))}
            </Bar>
            <Bar dataKey="kraken" radius={[4, 4, 0, 0]} barSize={12}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--primary)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
