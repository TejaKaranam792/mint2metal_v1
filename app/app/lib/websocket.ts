import { useEffect, useRef, useState } from 'react';

export enum WebSocketEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  TRANSACTION_UPDATE = 'transaction_update',
  BALANCE_UPDATE = 'balance_update',
  HEARTBEAT = 'heartbeat',
  PONG = 'pong',
  ERROR = 'error'
}

export interface WebSocketMessage {
  type: WebSocketEvent;
  payload?: any;
  timestamp: Date;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: Map<WebSocketEvent, ((message: WebSocketMessage) => void)[]> = new Map();
  private isConnected = false;

  constructor(private url: string, private token?: string) {}

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = this.token
      ? `${this.url}?token=${this.token}`
      : this.url;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isConnected = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  public send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public on(event: WebSocketEvent, callback: (message: WebSocketMessage) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: WebSocketEvent, callback?: (message: WebSocketMessage) => void): void {
    if (!this.listeners.has(event)) {
      return;
    }

    if (callback) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.listeners.delete(event);
    }
  }

  private handleOpen(): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectInterval = 1000;

    console.log('WebSocket connected');

    // Start heartbeat
    this.startHeartbeat();

    // Notify listeners
    this.emit({
      type: WebSocketEvent.CONNECT,
      timestamp: new Date()
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.emit(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(): void {
    this.isConnected = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log('WebSocket disconnected');

    this.emit({
      type: WebSocketEvent.DISCONNECT,
      timestamp: new Date()
    });

    // Attempt to reconnect
    this.scheduleReconnect();
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);

    this.emit({
      type: WebSocketEvent.ERROR,
      payload: { error },
      timestamp: new Date()
    });
  }

  private emit(message: WebSocketMessage): void {
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => callback(message));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: WebSocketEvent.HEARTBEAT,
          timestamp: new Date()
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  public isHealthy(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// React hook for WebSocket
export function useWebSocket(url: string, token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new WebSocketService(url, token);
    }

    const ws = wsRef.current;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleMessage = (message: WebSocketMessage) => setLastMessage(message);

    ws.on(WebSocketEvent.CONNECT, handleConnect);
    ws.on(WebSocketEvent.DISCONNECT, handleDisconnect);
    ws.on(WebSocketEvent.TRANSACTION_UPDATE, handleMessage);
    ws.on(WebSocketEvent.BALANCE_UPDATE, handleMessage);

    ws.connect();

    return () => {
      ws.off(WebSocketEvent.CONNECT, handleConnect);
      ws.off(WebSocketEvent.DISCONNECT, handleDisconnect);
      ws.off(WebSocketEvent.TRANSACTION_UPDATE, handleMessage);
      ws.off(WebSocketEvent.BALANCE_UPDATE, handleMessage);
    };
  }, [url, token]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    send: (message: WebSocketMessage) => wsRef.current?.send(message),
    disconnect: () => wsRef.current?.disconnect()
  };
}
