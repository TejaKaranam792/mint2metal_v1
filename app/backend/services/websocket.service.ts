import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import { ApiKeyService } from '../services/api-key.service';
import url from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  apiKeyId?: string;
  userId?: string;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private interval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    // Mount the WebSocket server to the /v1/stream path
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request, socket, head) => {
      const { pathname, query } = url.parse(request.url || '', true);

      if (pathname === '/v1/stream') {
        // Authenticate via query param for WebSockets (or header if provided by client during handshake)
        const apiKey = (query.apiKey as string) || (request.headers['x-api-key'] as string);

        if (!apiKey) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        try {
          const authRecord = await ApiKeyService.validateApiKey(apiKey);
          if (!authRecord) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          this.wss?.handleUpgrade(request, socket, head, (ws) => {
            const authWs = ws as AuthenticatedWebSocket;
            authWs.apiKeyId = authRecord.id;
            authWs.userId = authRecord.userId;
            authWs.subscriptions = new Set(["public"]); // Default subscription
            this.wss?.emit('connection', authWs, request);
          });
        } catch (err) {
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        }
      } else {
        // Ignore other paths or handle legacy dashboard connections
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
      console.log(`Institutional WebSocket client connected: User ${ws.userId}`);
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.action === 'subscribe' && data.channel) {
            ws.subscriptions.add(data.channel);
            ws.send(JSON.stringify({ event: 'subscribed', channel: data.channel }));
          } else if (data.action === 'unsubscribe' && data.channel) {
            ws.subscriptions.delete(data.channel);
            ws.send(JSON.stringify({ event: 'unsubscribed', channel: data.channel }));
          }
        } catch (error) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: User ${ws.userId}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({ event: 'connected', message: 'Mint2Metal Institutional Stream v1' }));
    });

    // Heartbeat to keep connections alive and clean up stale ones
    this.interval = setInterval(() => {
      this.wss?.clients.forEach((client) => {
        const ws = client as AuthenticatedWebSocket;
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('Institutional WebSocket service configured on /v1/stream');
  }

  // --- Domain Specific Broadcasters ---

  /**
   * Broadcast an event to all clients or clients subscribed to a specific channel
   */
  broadcastToChannel(channel: string, event: string, payload: any) {
    if (!this.wss) return;

    const message = JSON.stringify({ event, channel, payload, timestamp: new Date().toISOString() });

    this.wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket;
      if (ws.readyState === WebSocket.OPEN && ws.subscriptions.has(channel)) {
        ws.send(message);
      }
    });
  }

  broadcastSupplyUpdate(commodity: string, circulating: number, vaulted: number) {
    this.broadcastToChannel('supply.updates', 'supply_changed', { commodity, circulating, vaulted });
  }

  broadcastMintEvent(batchId: string, amount: number, txHash: string) {
    this.broadcastToChannel('mint.events', 'tokens_minted', { batchId, amount, txHash });
  }

  broadcastBurnEvent(redemptionId: string, amount: number, txHash: string) {
    this.broadcastToChannel('burn.events', 'tokens_burned', { redemptionId, amount, txHash });
  }

  broadcastLoanStateChange(loanId: string, status: string, newLtv: number) {
    this.broadcastToChannel('loan.collateral.state', 'loan_updated', { loanId, status, newLtv });
  }
}

