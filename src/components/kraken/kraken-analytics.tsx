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
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="w-full bg-card p-4 sm:p-6 border border-border/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground mb-1">Cost Efficiency Comparison</h3>
          <p className="text-[11px] text-muted-foreground font-mono">In-House Model Training vs. Telegraph Signal API</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-6 sm:gap-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#666666" }} />
              <span className="text-sm text-muted-foreground">Total Internal AI Cost</span>
            </div>
            <span className="text-sm font-medium text-foreground">${totalInternalCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-6 sm:gap-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-foreground/50" />
              <span className="text-sm text-muted-foreground">Total Telegraph Signal API Cost</span>
            </div>
            <span className="text-sm font-medium text-foreground">${totalDaemonCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div
        className="w-full min-w-0 shrink-0"
        style={{ height: CHART_HEIGHT_PX }}
      >
        {loading && chartData.length === 0 ? (
          <div className="flex items-end gap-2 px-2" style={{ height: CHART_HEIGHT_PX }}>
            {[40, 70, 55, 90, 60, 75, 45, 85, 50, 65, 80, 35].map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
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
              cursor={{ fill: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "0",
                fontSize: "12px",
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--foreground)" }}
              itemStyle={{ color: "var(--muted-foreground)" }}
            />
            <Bar dataKey="internal" radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false}>
              {chartData.map((_, index) => (
                <Cell key={`cell-internal-${index}`} fill="#666666" opacity={1} />
              ))}
            </Bar>
            <Bar dataKey="kraken" radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false}>
              {chartData.map((_, index) => (
                <Cell key={`cell-kraken-${index}`} fill="var(--foreground)" opacity={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
