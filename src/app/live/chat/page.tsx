"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { TerminalPanel } from "@/components/terminal-panel";
import { useLiveExecutor } from "@/lib/hooks/use-live-executor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LiveChatPage() {
  const {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    handleSend,
    handleNewChat,
  } = useLiveExecutor();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={handleNewChat}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] border-b border-border/50 flex items-center px-6 gap-4">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>
          <h1 className="text-lg font-bold">Neural Engine Gateway</h1>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <ChatArea messages={messages} isLoading={isLoading} />
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>
          <div className="hidden md:flex w-[400px] border-l border-border/50">
             <TerminalPanel 
               logs={terminalLogs} 
               showReceipt={!!terminalReceipt}
               receipt={terminalReceipt}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
