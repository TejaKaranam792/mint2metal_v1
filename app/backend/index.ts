import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import adminRoutes from './routes/admin';
import kycRoutes from './routes/kyc';
import loansRoutes from './routes/loans';
import mintRoutes from './routes/mint';
import redemptionRoutes from './routes/redemption';
import silverRoutes from './routes/silver';
import sorobanRoutes from './routes/soroban';
import tradingRoutes from './routes/trading';
import ordersRoutes from './routes/orders';
import walletRoutes from './routes/wallet';
import { WebSocketService } from './services/websocket.service';
import rateLimitMiddleware from './middleware/rate-limit.middleware';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(rateLimitMiddleware);

// Parse JSON for other routes
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/kyc', kycRoutes);
app.use('/loans', loansRoutes);
app.use('/mint', mintRoutes);
app.use('/redemption', redemptionRoutes);
app.use('/silver', silverRoutes);
app.use('/soroban', sorobanRoutes);
app.use('/trading', tradingRoutes);
app.use('/orders', ordersRoutes);
app.use('/wallet', walletRoutes);

// Initialize WebSocket service
const webSocketService = new WebSocketService();
webSocketService.initialize(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
