import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

export class WebSocketService {
  private wss: WebSocketServer | null = null;

  initialize(server: any) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      console.log('WebSocket client connected');

      ws.on('message', (message: Buffer) => {
        console.log('Received message:', message.toString());
        // Handle incoming messages
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log('WebSocket service initialized');
  }

  broadcast(data: any) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  }

  sendToClient(clientId: string, data: any) {
    // Implementation for sending to specific client
    // This would require tracking clients by ID
  }
}
