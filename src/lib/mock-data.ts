// ─── Conversation history ────────────────────────────────────────────────────

export type ConversationGroupItem = {
  id: string;
  title: string;
  archived?: boolean;
};

export type ConversationGroup = {
  label: string;
  items: ConversationGroupItem[];
};

export const conversationHistory: ConversationGroup[] = [
  {
    label: "Today",
    items: [
      { id: "ps-1", title: "Book flights: Miami beach trip" },
      { id: "ps-2", title: "Buy supplement from video ad" },
      { id: "ps-3", title: "Agriculture portfolio allocation" },
    ],
  },
];

// ─── Chat messages ────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export type MessageContent = { kind: "text"; text: string };

/** Live chat only: optimistic send / failure / retry (omitted in stored mock scenarios). */
export type MessageSendState = "ok" | "pending" | "failed";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  sendState?: MessageSendState;
  /** Present when `sendState === "failed"` */
  sendError?: string;
};

// ─── Terminal types ───────────────────────────────────────────────────────────

export type TerminalLogEntry = {
  time: string;
  label: string;
  detail: string;
  section: string; // section header label; header renders on first entry of each new section
};

export type TerminalReceipt = {
  provider: string;
  timestamp: string;
  confidence: string;
  settlementCost: string;
};

// ─── Prompt scenarios ─────────────────────────────────────────────────────────

export type PromptScenario = {
  id: string;
  category: string;
  icon: string; // lucide icon name key
  prompt: string;
  response: string;
  terminalLogs: TerminalLogEntry[];
  receipt: TerminalReceipt;
};

export const promptScenarios: PromptScenario[] = [
  // ── 1. Personal Life (Zeus) ────────────────────────────────────────────────
  {
    id: "ps-1",
    category: "Personal Life",
    icon: "plane",
    prompt: "Book flights and hotel for a beach trip to Miami next weekend.",
    response:
      "Signal verified. Zeus subnet confirms zero precipitation and optimal 82-degree conditions for the 3-day window. Booking executed and paid. Flying with United Airlines (Flight UA420).",
    terminalLogs: [
      { time: "14:32:01.042", label: "ROUTING", detail: "Request broadcasted to Zeus Subnet #12", section: "Initial Routing" },
      { time: "14:32:01.215", label: "WALLET",  detail: "Checking balance on connected address (0x74a…8b2)", section: "Initial Routing" },
      { time: "14:32:01.288", label: "STATUS",  detail: "Handshake established with Zeus Node", section: "Initial Routing" },
      { time: "14:32:01.412", label: "WEATHER", detail: "Fetching 3-day forecast for Miami, FL", section: "Zeus Analysis" },
      { time: "14:32:01.598", label: "ZEUS",    detail: "Zero precipitation — 82 °F optimal conditions confirmed", section: "Zeus Analysis" },
      { time: "14:32:01.721", label: "BOOKING", detail: "Searching available flights and hotels for next weekend", section: "Zeus Analysis" },
      { time: "14:32:01.856", label: "BILLING", detail: "Deducting $0.01 ×402 micro-fee", section: "Payment and Rail" },
      { time: "14:32:01.934", label: "NETWORK", detail: "Selected rail: Solana (Mainnet-Beta)", section: "Payment and Rail" },
      { time: "14:32:02.012", label: "TX",      detail: "Initiating booking settlement (id: a1b2…c3d4)", section: "Payment and Rail" },
      { time: "14:32:02.198", label: "PROOF",   detail: "Verifying zero-knowledge proof", section: "Proof Verification" },
      { time: "14:32:02.341", label: "SIGNAL",  detail: "Consensus reached — UA420 booked and paid", section: "Proof Verification" },
    ],
    receipt: {
      provider: "ZEUS",
      timestamp: "2026-03-31 14:32:02 UTC",
      confidence: "99.8%",
      settlementCost: "$0.01",
    },
  },

  // ── 2. Social Media (Bitmind) ──────────────────────────────────────────────
  {
    id: "ps-2",
    category: "Social Media",
    icon: "video",
    prompt: "Buy the supplement from this video ad.",
    response:
      "Signal verified. Bitmind subnet confirms 99.9% probability of authentic creator video. No synthetic audio detected. Transaction approved. 1 bottle purchased. Delivery date 15th November 2026. Shipping with FedEx.",
    terminalLogs: [
      { time: "14:33:01.042", label: "ROUTING",  detail: "Request broadcasted to Bitmind Subnet #7", section: "Initial Routing" },
      { time: "14:33:01.215", label: "WALLET",   detail: "Checking balance on connected address (0x74a…8b2)", section: "Initial Routing" },
      { time: "14:33:01.288", label: "STATUS",   detail: "Handshake established with Bitmind Node", section: "Initial Routing" },
      { time: "14:33:01.410", label: "SCAN",     detail: "Analyzing video frames for synthetic media markers", section: "Bitmind Scan" },
      { time: "14:33:01.572", label: "AUDIO",    detail: "Running audio deepfake detection model", section: "Bitmind Scan" },
      { time: "14:33:01.698", label: "BITMIND",  detail: "99.9% authenticity score — no synthetic audio detected", section: "Bitmind Scan" },
      { time: "14:33:01.812", label: "BILLING",  detail: "Deducting $0.01 ×402 micro-fee", section: "Payment and Rail" },
      { time: "14:33:01.934", label: "NETWORK",  detail: "Selected rail: Solana (Mainnet-Beta)", section: "Payment and Rail" },
      { time: "14:33:02.041", label: "TX",       detail: "Initiating purchase transaction (id: f8e3…9k1)", section: "Payment and Rail" },
      { time: "14:33:02.187", label: "PROOF",    detail: "Verifying zero-knowledge proof", section: "Proof Verification" },
      { time: "14:33:02.312", label: "SIGNAL",   detail: "Approved — 1 bottle purchased, shipping via FedEx", section: "Proof Verification" },
    ],
    receipt: {
      provider: "BITMIND",
      timestamp: "2026-03-31 14:33:02 UTC",
      confidence: "99.9%",
      settlementCost: "$0.01",
    },
  },

  // ── 3. Investing (Score) ───────────────────────────────────────────────────
  {
    id: "ps-3",
    category: "Investing",
    icon: "trending",
    prompt: "Execute monthly agriculture portfolio allocation.",
    response:
      "Alert: Score subnet vision models detect severe drought anomalies across Kellogg's supplier farms. Kellogg's buy order cancelled. Rerouting capital: Score detects a 15% increase in healthy crop yields across General Mills fields. Buy order executed for 500 shares of General Mills (GIS).",
    terminalLogs: [
      { time: "14:34:01.042", label: "ROUTING", detail: "Request broadcasted to Score Subnet #31", section: "Initial Routing" },
      { time: "14:34:01.215", label: "WALLET",  detail: "Checking balance on connected address (0x74a…8b2)", section: "Initial Routing" },
      { time: "14:34:01.288", label: "STATUS",  detail: "Handshake established with Score Node", section: "Initial Routing" },
      { time: "14:34:01.401", label: "VISION",  detail: "Running satellite crop-yield analysis models", section: "Score Analysis" },
      { time: "14:34:01.554", label: "ALERT",   detail: "Drought anomalies detected across Kellogg's supplier farms", section: "Score Analysis" },
      { time: "14:34:01.689", label: "SCORE",   detail: "+15% healthy crop yields across General Mills fields", section: "Score Analysis" },
      { time: "14:34:01.801", label: "CANCEL",  detail: "Kellogg's (K) buy order cancelled", section: "Payment and Rail" },
      { time: "14:34:01.912", label: "BILLING", detail: "Deducting $0.01 micro-fee", section: "Payment and Rail" },
      { time: "14:34:02.031", label: "NETWORK", detail: "Selected rail: Solana (Mainnet-Beta)", section: "Payment and Rail" },
      { time: "14:34:02.189", label: "TX",      detail: "Executing buy order: 500 shares GIS (General Mills)", section: "Proof Verification" },
      { time: "14:34:02.341", label: "SIGNAL",  detail: "Order confirmed — 500 GIS shares purchased", section: "Proof Verification" },
    ],
    receipt: {
      provider: "SCORE",
      timestamp: "2026-03-31 14:34:02 UTC",
      confidence: "97.6%",
      settlementCost: "$0.01",
    },
  },
];
