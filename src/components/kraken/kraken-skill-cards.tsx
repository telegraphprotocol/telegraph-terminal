"use client";

import { motion } from "framer-motion";
import { Link2, ServerOff } from "lucide-react";
import Link from "next/link";
import type { SubnetPickItem } from "@/lib/subnet-catalog";

export type KrakenSkillCardsProps = {
  engineSubnets: SubnetPickItem[];
  subnetsLoading: boolean;
  subnetsError: string | null;
};

export function KrakenSkillCards({
  engineSubnets,
  subnetsLoading,
  subnetsError,
}: KrakenSkillCardsProps) {
  if (subnetsLoading) {
    return (
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border/50 bg-card p-6"
          >
            <div className="mb-6 h-14 w-14 rounded-xl bg-muted/40" />
            <div className="mb-2 h-6 w-[80%] max-w-[240px] rounded bg-muted/40" />
            <div className="mb-4 h-20 rounded bg-muted/30" />
            <div className="h-10 rounded-xl bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  const offline =
    Boolean(subnetsError) || engineSubnets.length === 0;

  if (offline) {
    return (
      <div className="w-full rounded-xl border border-border/50 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ServerOff size={28} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-foreground">No live engine subnets</h3>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          {subnetsError ??
            "The dashboard only lists subnets returned by the engine at `/v1/subnets`. Start the engine or fix your API URL — placeholder protocol cards are not shown when data is unavailable."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/80">
          Use the subnet picker in the header once the engine is reachable, or open the{" "}
          <Link href="/intelligence-terminal" className="font-semibold text-primary underline-offset-2 hover:underline">
            Intelligence Terminal
          </Link>{" "}
          to route queries.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {engineSubnets.slice(0, 9).map((subnet, i) => (
        <motion.div
          key={subnet.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.4) }}
          className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/40"
        >
          <div className="mb-6 flex items-start justify-between">
            <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Link2 size={28} />
            </div>
            <span className="rounded-lg bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              SN{subnet.id}
            </span>
          </div>

          <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">{subnet.label}</h3>
          <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
            Engine-registered subnet. Queries can be routed here from the Intelligence Terminal.
          </p>

          <Link
            href="/intelligence-terminal"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-border/50 bg-muted/50 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Open terminal
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
