"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  PenSquare,
  PanelLeftClose,
  Search,
  Settings,
  HelpCircle,
  MoreHorizontal,
  Archive,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { conversationHistory, type ConversationGroup } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() ||
  "https://telegraphprotocol.com/support";
const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL?.trim() ||
  "https://docs.telegraphprotocol.com";

export type LiveChatSidebarActions = {
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

export type SidebarWalletFooter = {
  label: string;
  subtitle?: string;
  initials?: string | null;
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  activeId?: string;
  onSelect?: (id: string) => void;
  onNewChat?: () => void;
  /** When set (e.g. live terminal), replaces mock demo history */
  historyGroups?: ConversationGroup[];
  /** Live terminal: row menu + archive/delete with confirmation */
  liveChatActions?: LiveChatSidebarActions;
  /** When set (e.g. Terminal Backend custodial wallet), replaces default footer identity */
  walletFooter?: SidebarWalletFooter | null;
}

export function Sidebar({
  isOpen,
  onToggle,
  activeId,
  onSelect,
  onNewChat,
  historyGroups,
  liveChatActions,
  walletFooter,
  showHistory = true,
}: SidebarProps & { showHistory?: boolean }) {
  const walletLabel = walletFooter?.label ?? "Test User";
  const walletInitials = walletFooter?.initials ?? null;
  const footerLine2 = walletFooter
    ? walletFooter.subtitle?.trim() || "Global wallet"
    : "Pro Account";

  const groups = historyGroups ?? conversationHistory;
  /** Portal menu — avoids clipping from sidebar `overflow-hidden` / scroll containers. */
  const [openChatMenu, setOpenChatMenu] = useState<{
    id: string;
    archived: boolean;
    anchor: DOMRect;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const menuPortalRef = useRef<HTMLUListElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!openChatMenu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (menuPortalRef.current?.contains(t)) return;
      if (t.closest(`[data-chat-menu-trigger="${openChatMenu.id}"]`)) return;
      setOpenChatMenu(null);
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [openChatMenu]);

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
            className="p-2 hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all duration-200"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
          
          <div className="flex items-center gap-1">
             <button
              className="p-2 hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all duration-200"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={onNewChat}
              className="p-2 border border-border/60 text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-all duration-200"
              aria-label="New chat"
            >
              <PenSquare size={18} />
            </button>
          </div>
        </div>

        {/* History List */}
        {showHistory && (
          <nav className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
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
                        className="relative"
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1 rounded-xl transition-all duration-300 group relative",
                            activeId === item.id
                              ? "bg-foreground/5 text-foreground border-l border-foreground/30"
                              : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelect?.(item.id);
                              setOpenChatMenu(null);
                            }}
                            className="relative flex-1 min-w-0 text-left px-3 py-2.5 text-[13px] font-medium"
                          >
                            <span className="relative z-10 truncate block">{item.title}</span>
                            {activeId === item.id && (
                              <motion.div
                                layoutId="active-pill"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-4 bg-foreground/50"
                              />
                            )}
                          </button>
                          {liveChatActions ? (
                            <div className="relative shrink-0 pr-1.5">
                              <button
                                type="button"
                                data-chat-menu-trigger={item.id}
                                aria-label="Chat options"
                                aria-expanded={openChatMenu?.id === item.id}
                                aria-haspopup="menu"
                                className={cn(
                                  "rounded-full border border-border/60 p-1 text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors",
                                  openChatMenu?.id === item.id &&
                                    "bg-background/80 text-foreground border-border/60",
                                )}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const btn = e.currentTarget as HTMLElement;
                                  setOpenChatMenu((prev) =>
                                    prev?.id === item.id
                                      ? null
                                      : {
                                          id: item.id,
                                          archived: !!item.archived,
                                          anchor: btn.getBoundingClientRect(),
                                        },
                                  );
                                }}
                              >
                                <MoreHorizontal size={14} strokeWidth={2.25} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ))}
            </AnimatePresence>
          </nav>
        )}

        {/* Footer */}
        <div className="p-4 space-y-2 border-t border-border/40">
          <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-accent/50 cursor-pointer transition-all group">
            <div className="w-8 h-8 border border-border/60 flex items-center justify-center shrink-0 bg-muted">
              <span className="text-[11px] text-foreground font-black">
                {walletInitials ?? "TM"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground/90 truncate group-hover:text-foreground transition-colors">
                {walletLabel ?? "Test User"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 truncate uppercase tracking-widest font-medium">
                {footerLine2}
              </p>
            </div>
            <Settings size={14} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
          
          <div className="flex items-center justify-center gap-4 pt-2">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-muted-foreground/40 hover:text-foreground uppercase tracking-widest transition-colors inline-flex items-center gap-1"
            >
              <HelpCircle size={12} />
              Support
            </a>
            <div className="w-1 h-1 rounded-full bg-border" />
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-muted-foreground/40 hover:text-foreground uppercase tracking-widest transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </div>

      {mounted &&
        openChatMenu &&
        liveChatActions &&
        createPortal(
          <ul
            ref={menuPortalRef}
            role="menu"
            className="fixed z-[250] min-w-[160px] rounded-xl border border-border/60 bg-popover py-1 shadow-xl backdrop-blur-xl"
            style={{
              top: openChatMenu.anchor.bottom + 4,
              left: Math.max(
                8,
                Math.min(
                  typeof window !== "undefined"
                    ? window.innerWidth - 168
                    : 0,
                  openChatMenu.anchor.right - 160,
                ),
              ),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {!openChatMenu.archived ? (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-foreground hover:bg-accent"
                  onClick={() => {
                    liveChatActions.onArchive(openChatMenu.id);
                    setOpenChatMenu(null);
                  }}
                >
                  <Archive size={14} />
                  Archive
                </button>
              </li>
            ) : (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-foreground hover:bg-accent"
                  onClick={() => {
                    liveChatActions.onRestore(openChatMenu.id);
                    setOpenChatMenu(null);
                  }}
                >
                  <RotateCcw size={14} />
                  Restore
                </button>
              </li>
            )}
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  setOpenChatMenu(null);
                  setDeleteConfirmId(openChatMenu.id);
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </li>
          </ul>,
          document.body,
        )}

      {deleteConfirmId && liveChatActions ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-chat-title"
          aria-describedby="delete-chat-desc"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <h2 id="delete-chat-title" className="text-lg font-bold text-foreground">
              Delete this chat?
            </h2>
            <p id="delete-chat-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This removes the conversation from this browser. You can’t undo it.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-red-500 transition-colors"
                onClick={() => {
                  liveChatActions.onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
