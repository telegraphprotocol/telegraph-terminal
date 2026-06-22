"use client";

import { motion } from "framer-motion";
import { Link2, ServerOff } from "lucide-react";
import Link from "next/link";
import type { SubnetPickItem } from "@/lib/subnet-catalog";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col border border-border/50 bg-card p-6">
            <div className="mb-6 flex items-start justify-between">
              <Skeleton className="h-14 w-14" />
              <Skeleton className="h-6 w-10" />
            </div>
            <Skeleton className="mb-3 h-6 w-3/4" />
            <Skeleton className="mb-2 h-4 w-full flex-1" />
            <Skeleton className="mb-1 h-4 w-5/6" />
            <Skeleton className="mt-6 h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const offline =
    Boolean(subnetsError) || engineSubnets.length === 0;

  if (offline) {
    return (
      <div className="w-full border border-border/50 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <ServerOff size={28} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-foreground">No live engine miners</h3>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          {subnetsError ?? "Routing service is temporarily unavailable. Check back shortly or open the Intelligence Terminal to send queries."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/80">
          Use the subnet picker in the header once the engine is reachable, or open the{" "}
          <Link href="/intelligence-terminal" className="font-semibold text-foreground underline-offset-2 hover:underline">
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
          className="group flex flex-col border border-border/50 bg-card p-6 transition-all hover:border-foreground/20"
        >
          <div className="mb-6 flex items-start justify-between">
            <div className="border border-border/60 p-3 text-muted-foreground transition-colors group-hover:border-foreground/30 group-hover:text-foreground">
              <Link2 size={28} />
            </div>
            <span className="bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground border border-border/40">
              {subnet.id}
            </span>
          </div>

          <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">{subnet.label}</h3>
          <p className="mb-6 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            Engine-registered subnet. Queries can be routed here from the Intelligence Terminal.
          </p>

          <Link
            href="/intelligence-terminal"
            className="mt-auto flex h-9 w-full items-center justify-center border border-border/50 bg-muted/50 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:bg-muted hover:border-foreground/30"
          >
            Open terminal
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
