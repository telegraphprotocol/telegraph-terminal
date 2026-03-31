"use client";

import { PenSquare, PanelLeftClose } from "lucide-react";
import { conversationHistory } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  activeId?: string;
  onSelect?: (id: string) => void;
  onNewChat?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  onToggle,
  activeId,
  onSelect,
  onNewChat,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        // Outer shell — clips content during the width collapse
        "shrink-0 overflow-hidden",
        // Mobile: fixed overlay, width stays 220 px, slide via transform
        "fixed inset-y-0 left-0 z-50 h-full w-[248px]",
        // Desktop: relative inline, width animates
        "md:relative md:z-auto",
        // Animation
        "transition-all duration-300 ease-in-out",
        // Open / closed states
        isOpen
          ? "translate-x-0 md:w-[248px]"
          : "-translate-x-full md:w-0 md:translate-x-0",
      )}
    >
      {/*
        Inner wrapper: fixed 220 px so content never reflows while the outer
        element collapses — overflow-hidden on the outer clips it cleanly.
      */}
      <div className="flex flex-col h-full w-[248px] min-w-[248px] border-r border-border bg-sidebar">
        {/* Top actions: PanelLeftClose (left) — PenSquare (right) */}
        <div className="flex items-center justify-between px-3 py-3 shrink-0">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="New chat"
          >
            <PenSquare size={17} />
          </button>
        </div>

        {/* Conversation history */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
          {conversationHistory.map((group) => (
            <div key={group.label}>
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => onSelect?.(item.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors truncate",
                        activeId === item.id
                          ? "bg-secondary text-foreground"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="px-3 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs text-primary font-semibold">T</span>
            </div>
            <span className="text-sm text-foreground/80 truncate">
              Test User
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
