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
import apiV1Routes from './routes/api-v1';
import assetRoutes from './routes/asset';
import apiKeyRoutes from './routes/api-keys';
import b2bRoutes from './routes/b2b';
import oracleRoutes from './routes/oracle';
import sep10Routes from './routes/sep10';
import sep24Routes from './routes/sep24';
import stellarTomlRoutes from './routes/stellar-toml';
import bankRoutes from './routes/bank';
import { startOracleScheduler } from './services/oracle-scheduler.service';
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
app.use('/api/v1', apiV1Routes);
app.use('/asset', assetRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/b2b', b2bRoutes);
app.use('/api/oracle', oracleRoutes);

// Anchor Routes
app.use('/auth', sep10Routes);
app.use('/sep24', sep24Routes);
app.use('/.well-known', stellarTomlRoutes);
app.use('/bank', bankRoutes);

// Initialize WebSocket service
const webSocketService = new WebSocketService();
webSocketService.initialize(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  // Start oracle price scheduler — runs every 5 minutes
  startOracleScheduler();
});
