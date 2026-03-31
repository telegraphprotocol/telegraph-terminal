"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Wallet, PanelLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

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

  // Close dropdown on outside click
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
    <header className="flex items-center px-3 h-14 border-b border-border bg-background shrink-0 gap-2">
      {/* Left: open-sidebar button (only when sidebar is closed) + title */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Open sidebar"
          >
            <PanelLeft size={17} />
          </button>
        )}
        <h1 className="lg:text-base text-sm font-medium text-foreground truncate lg:pl-1">
          Telegraph Intelligence Terminal
        </h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Dark / Light toggle */}
        <ThemeToggle />

        {/* Network dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm text-foreground"
          >
            <span className="hidden sm:inline text-sm">{selectedNetwork}</span>
            <ChevronDown
              size={13}
              className={cn(
                "text-muted-foreground transition-transform duration-200",
                dropdownOpen && "rotate-180",
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[148px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
              {NETWORKS.map((network) => (
                <button
                  key={network}
                  onClick={() => {
                    setSelectedNetwork(network);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-sm transition-colors text-left",
                    selectedNetwork === network
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {network}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Connect Wallet */}
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors border border-border">
          <Wallet size={14} />
          <span className="hidden sm:inline">Connect</span>
        </button>
      </div>
    </header>
  );
}
