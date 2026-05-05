"use client";

import { PenSquare, PanelLeftClose, Search, Settings, HelpCircle } from "lucide-react";
import { conversationHistory } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
        "shrink-0 overflow-hidden fixed inset-y-0 left-0 z-50 h-full w-[260px] md:relative md:z-auto transition-all duration-500 ease-[0.16, 1, 0.3, 1]",
        isOpen
          ? "translate-x-0 md:w-[260px]"
          : "-translate-x-full md:w-0 md:translate-x-0",
      )}
    >
      <div className="flex flex-col h-full w-[260px] min-w-[260px] border-r border-border/40 bg-sidebar/80 backdrop-blur-2xl">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0">
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
          
          <div className="flex items-center gap-1">
             <button
              className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={onNewChat}
              className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 shadow-sm shadow-primary/20"
              aria-label="New chat"
            >
              <PenSquare size={18} />
            </button>
          </div>
        </div>

        {/* History List */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {conversationHistory.map((group) => (
              <div key={group.label} className="mt-4">
                <p className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <motion.li 
                      key={item.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <button
                        onClick={() => onSelect?.(item.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 group relative overflow-hidden",
                          activeId === item.id
                            ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(140,89,255,0.2)]"
                            : "text-foreground/70 hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <span className="relative z-10 truncate block">{item.title}</span>
                        {activeId === item.id && (
                          <motion.div 
                            layoutId="active-pill"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full"
                          />
                        )}
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>
            ))}
          </AnimatePresence>
        </nav>

        {/* Footer */}
        <div className="p-4 space-y-2 border-t border-border/40">
          <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-accent/50 cursor-pointer transition-all group">
            <div className="w-8 h-8 rounded-full bg-gradient-premium flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <span className="text-[11px] text-white font-black">TM</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground/90 truncate group-hover:text-primary transition-colors">Test User</p>
              <p className="text-[10px] text-muted-foreground/60 truncate uppercase tracking-widest font-medium">Pro Account</p>
            </div>
            <Settings size={14} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
          
          <div className="flex items-center justify-center gap-4 pt-2">
             <button className="text-[10px] font-bold text-muted-foreground/40 hover:text-foreground uppercase tracking-widest transition-colors flex items-center gap-1">
                <HelpCircle size={12} />
                Support
             </button>
             <div className="w-1 h-1 rounded-full bg-border" />
             <button className="text-[10px] font-bold text-muted-foreground/40 hover:text-foreground uppercase tracking-widest transition-colors">
                Docs
             </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
