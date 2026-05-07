import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_ENGINE_WS_URL || 'ws://localhost:7044/ws';

export type WSMessage = {
  type: 'ask' | 'ask_direct' | 'list_subnets' | 'ping';
  data?: any;
  payload?: any;
  query?: string;
  subnet_id?: string;
  endpoint?: string;
};

export function useEngineWS() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to Engine WebSocket');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from Engine WebSocket');
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    socket.onerror = (error) => {
      console.error('WS Error:', error);
      socket.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WS not connected, cannot send message');
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
}
