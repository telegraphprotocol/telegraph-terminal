import { useState, useEffect, useCallback, useRef } from "react";
import { EngineWsAction, EngineWsFrame } from "@/lib/engine-daemon-types";

const WS_URL = process.env.NEXT_PUBLIC_ENGINE_WS_URL || "ws://localhost:7044/ws";

export function useEngineWS() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<EngineWsFrame | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const handlersRef = useRef<Set<(frame: EngineWsFrame) => void>>(new Set());
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(function connectSocket() {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setLastError(null);
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as EngineWsFrame;
        setLastMessage(data);
        handlersRef.current.forEach((handler) => handler(data));
      } catch {
        setLastError("Failed to parse WS message");
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (!shouldReconnectRef.current) return;
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), 3000);
    };

    socket.onerror = () => {
      setLastError("WebSocket connection error");
      socket.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message: EngineWsAction) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      setLastError("WS not connected, cannot send message");
    }
  }, []);

  const subscribe = useCallback((handler: (frame: EngineWsFrame) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    lastError,
    sendMessage,
    subscribe,
  };
}
