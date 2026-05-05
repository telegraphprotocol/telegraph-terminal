"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Wallet, PanelLeft, Cpu, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const NETWORKS = [
  "Bittensor",
  "Ritual",
  "Morpheus",
  "Autonolas",
  "Akash",
  "Fetch.ai",
];

interface TopNavProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopNav({ sidebarOpen, onToggleSidebar }: TopNavProps) {
  const [selectedNetwork, setSelectedNetwork] = useState("Bittensor");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex items-center px-4 h-16 border-b border-border/40 bg-background/60 backdrop-blur-md shrink-0 gap-4 z-40">
      {/* Left Section */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 shrink-0"
            aria-label="Open sidebar"
          >
            <PanelLeft size={19} />
          </button>
        )}
        <div className="flex flex-col min-w-0">
           <h1 className="text-[15px] font-bold text-foreground/90 tracking-tight flex items-center gap-2">
            <span className="text-gradient-premium hidden sm:inline">Telegraph</span>
            <span className="sm:hidden text-primary">Telegraph</span>
            <span className="text-muted-foreground/40 font-black">/</span>
            <span className="truncate">Intelligence Terminal</span>
          </h1>
          <div className="flex items-center gap-1.5 opacity-60">
             <Globe size={10} className="text-primary" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Neural Gateway v1.4.2</span>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />

        {/* Network Selection */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-[13px] font-semibold text-foreground/80 group",
              dropdownOpen && "border-primary/40 bg-primary/5"
            )}
          >
            <Cpu size={14} className="text-primary/60 group-hover:text-primary transition-colors" />
            <span className="hidden sm:inline">{selectedNetwork}</span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground transition-transform duration-500 ease-[0.16, 1, 0.3, 1]",
                dropdownOpen && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] rounded-2xl border border-border/50 bg-popover/80 backdrop-blur-xl shadow-2xl shadow-primary/20 p-1.5 overflow-hidden"
              >
                {NETWORKS.map((network) => (
                  <button
                    key={network}
                    onClick={() => {
                      setSelectedNetwork(network);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-left rounded-lg flex items-center justify-between group",
                      selectedNetwork === network
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {network}
                    {selectedNetwork === network && (
                       <div className="w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connect Wallet */}
        <button className="flex items-center gap-2 h-9 px-4 rounded-xl bg-gradient-premium hover:shadow-[0_0_20px_rgba(140,89,255,0.4)] text-white text-[13px] font-bold transition-all duration-300 border-none">
          <Wallet size={15} />
          <span className="hidden sm:inline">Connect Wallet</span>
        </button>
      </div>
    </header>
  );
}
