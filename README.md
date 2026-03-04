# Mint2Metal — Decentralized Precious Metals Tokenization on Stellar

> **Bridging physical silver to the Stellar blockchain with institutional-grade compliance, real-time price oracles, and programmable DeFi primitives.**

[![Stellar](https://img.shields.io/badge/Blockchain-Stellar-blue?logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet)](https://soroban.stellar.org)
[![IPFS](https://img.shields.io/badge/Proof%20of%20Reserve-IPFS-green)](https://ipfs.tech)
[![SEP-24](https://img.shields.io/badge/SEP--10%2F24-Stellar%20Anchor-orange)](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌐 Overview

**Mint2Metal** is an open-source, permissioned DeFi platform that tokenizes physical silver (XAG) on the [Stellar](https://stellar.org) blockchain. Each **XAG token** represents exactly **one gram of .999 fine silver** held in a custodied vault, with every mint event cryptographically linked to an immutable **proof-of-reserve document anchored on IPFS** and recorded on-chain via Stellar's `manageData` operations.

The platform targets a broad user base — retail investors, institutional buyers, and fintech integrators — by combining:

- **Trustless reserve verification** via IPFS CID anchoring on the Stellar ledger
- **Regulatory compliance** through KYC/AML pipelines powered by [Sumsub](https://sumsub.com)
- **Stellar Anchor compliance** following SEP-10 (Web Authentication) and SEP-24 (Interactive Anchor/Wallet Asset Flows)
- **Real-time silver pricing** via a decentralized Oracle Aggregator Soroban smart contract
- **DeFi primitives** including peer-to-peer trading, XAG-collateralized XLM loans, and physical delivery redemptions

---

## 🎯 Problem Statement

The precious metals market suffers from significant inefficiencies:

| Traditional Metals Market | Mint2Metal |
|---|---|
| Opaque custody & no real-time verification | On-chain proof-of-reserve with IPFS + Stellar `manageData` |
| Settlement delays of T+2 or longer | Near-instant Stellar settlement (~5 seconds) |
| High barriers to entry (min. purchase sizes) | Fractional ownership, buy from 1 gram |
| No programmability or composability | Soroban smart contracts enable lending, DEX trading |
| Jurisdiction-locked distribution | Global via Stellar Anchor Protocol (SEP-24) |
| Manual KYC onboarding | Automated KYC/AML via Sumsub API + AML scoring engine |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     MINT2METAL PLATFORM                          │
├─────────────────────────┬────────────────────────────────────────┤
│   NEXT.JS FRONTEND      │         EXPRESS BACKEND (API)          │
│   - Landing Page        │   - Auth (JWT + Google OAuth)          │
│   - User Dashboard      │   - KYC/AML (Sumsub Integration)       │
│   - Admin Panel         │   - Trading Engine                     │
│   - Trading UI          │   - Loan Service                       │
│   - Loan Interface      │   - Redemption Pipeline                │
│   - Redemption Flow     │   - Oracle Scheduler (5-min cron)      │
│   - KYC Onboarding      │   - SEP-10 / SEP-24 Anchor             │
│   - Wallet Connect      │   - B2B REST API + API Key Auth        │
│   - Proof of Reserves   │   - WebSocket (real-time prices)       │
├─────────────────────────┼────────────────────────────────────────┤
│         STELLAR BLOCKCHAIN (TESTNET → MAINNET)                   │
│   - XAG Asset (1g silver = 1 XAG)                                │
│   - Soroban OracleAggregator Contract                            │
│   - Stellar Asset Contract (SAC) for XAG                         │
│   - manageData: por_ipfs_cid, por_timestamp, por_vault           │
│   - Clawback / Freeze (regulatory compliance)                    │
├─────────────────────────┴────────────────────────────────────────┤
│   POSTGRESQL (Prisma ORM)    │   IPFS (Proof of Reserve Docs)    │
│   - Users, KYC, Wallets      │   - CIDv0 / CIDv1 support         │
│   - Orders, Trades, Loans    │   - Anchored on Stellar ledger     │
│   - VaultReceipts, Mints     │   - Public verifiability           │
│   - OraclePriceSubmissions   │                                    │
│   - AuditLogs, ApiKeys       │                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🔐 Identity & Compliance
- **KYC Onboarding** — Multi-level KYC via Sumsub with document verification, liveness checks, and automated review
- **AML Scoring Engine** — In-house transaction risk scoring; flags and blocks suspicious wallets
- **Role-Based Access Control** — Granular roles: `USER`, `ADMIN`, `ORACLE_SUBMITTER`, `MINT_EXECUTOR`, `TREASURY_ADMIN`, `CUSTODY_VERIFIER`, `API_INTEGRATOR`
- **2FA Support** — Time-based one-time passwords for admin and sensitive user actions
- **Audit Logging** — Immutable audit trail for every privileged action with IP and user-agent capture

### 🥈 Asset Tokenization (XAG)
- **1:1 Physical Backing** — Every XAG token is backed by one gram of .999 fine silver in a custodied vault
- **Vault Inventory Guard** — Smart contract enforced: you cannot mint more XAG than unminted silver in the vault database
- **IPFS Proof-of-Reserve** — Admin uploads reserve documents to IPFS; CID is validated on the backend, stored in PostgreSQL, and anchored on-chain via `manageData` on the Stellar Treasury account
- **Clawback & Freeze** — `AUTH_CLAWBACK_ENABLED` and `AUTH_REVOCABLE` flags on the issuer account for regulatory asset recovery
- **Settlement Batching** — Batch mint settlement with on-chain batch IDs and Proof-of-Reserve hashes

### 📈 Oracle-Powered Pricing
- **Decentralized Oracle Aggregator** — Soroban smart contract accepts price submissions from a permissioned set of oracle submitters
- **Multi-Source Feeds** — Prices aggregated from Metals.live and Yahoo Finance, with median computation
- **Automated Scheduler** — Oracle price submitted every **5 minutes** automatically via a backend cron job
- **Emergency Pause** — Admin can halt price updates via `/api/oracle/emergency-pause` for circuit-breaker protection
- **Price Locks** — Users lock prices for a time window before executing a trade, preventing front-running

### 💱 Peer-to-Peer Trading
- **Order Book** — BUY/SELL intents matched into Trades with settlement via the Stellar backend
- **Price-Locked Orders** — Orders locked to a specific price for a defined expiry window
- **Admin Settlement & Rejection** — Admin reviews pending orders and triggers on-chain Stellar settlements
- **Real-Time WebSocket** — Live silver price feed pushed to all connected clients via WebSocket

### 💳 DeFi Lending (XAG-Collateralized Loans)
- **Collateral Locking** — Users lock XAG as collateral to receive XLM loans from the Treasury
- **Admin Approval Flow** — Loans reviewed and approved by admin with on-chain XLM disbursement to borrower
- **Repayment Engine** — Users repay XLM; backend verifies the Stellar payment and releases XAG collateral
- **Full Loan Lifecycle** — States: `PENDING_APPROVAL → APPROVED → ACTIVE → REPAID / CLOSED`

### 📦 Physical Redemption
- **Redemption Requests** — Users request physical delivery of silver, specifying grams and shipping address
- **Multi-Step Admin Workflow** — Approve → Execute (burn tokens) → Dispatch (with tracking number)
- **Token Burn** — XAG tokens are burned from the user's wallet on redemption approval
- **Redemption Queue** — Admins view a sorted queue of pending physical deliveries

### 🏦 Stellar Anchor (SEP-10 / SEP-24)
- **SEP-10 Web Authentication** — Stellar-standard challenge/response authentication for wallets
- **SEP-24 Interactive Flows** — Deposit and withdrawal flows compliant with the Stellar Anchor protocol, enabling any SEP-24 wallet to interact with Mint2Metal
- **stellar.toml** — Well-known file served at `/.well-known/stellar.toml` for wallet discovery
- **Bank Integration** — `/bank` endpoints for fiat rail integration

### 🔌 B2B REST API
- **API Key Management** — Users can generate scoped API keys with configurable permissions and rate limits
- **Versioned API** — `/api/v1` namespace with endpoints for assets, prices, and programmatic trading
- **Rate Limiting** — Middleware-enforced rate limits per API key (default 100 req/min)
- **Developer Portal** — UI for generating and managing API keys

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Blockchain** | Stellar (Horizon API), Soroban smart contracts (Rust) |
| **Smart Contracts** | Soroban (Rust): OracleAggregator, Stellar Asset Contract (SAC) |
| **KYC/AML** | Sumsub API |
| **Proof of Reserve** | IPFS (CIDv0/v1), Stellar `manageData` |
| **Real-Time** | WebSocket (`ws`) |
| **Authentication** | JWT, Google OAuth 2.0, SEP-10 |
| **Deployment** | PM2, environment-separated config |

---

## 📂 Repository Structure

```
Mint2Metal/
├── app/
│   ├── app/                    # Next.js frontend
│   │   ├── landing/            # Marketing landing page
│   │   ├── (dashboard)/        # Authenticated user/admin dashboard
│   │   │   ├── dashboard/      # Trading, Loans, Redemption, KYC pages
│   │   │   └── admin/          # Admin management panel
│   │   ├── auth/               # Login, register, OAuth callback
│   │   ├── components/         # Reusable UI components
│   │   └── lib/                # Auth context, API helpers
│   ├── backend/                # Express API server
│   │   ├── routes/             # 21 route handlers (auth, admin, trading, etc.)
│   │   ├── services/           # Business logic (18 services)
│   │   ├── prisma/             # Database schema & migrations
│   │   └── middleware/         # Rate limiting, auth
│   └── contracts/              # Soroban smart contracts (Rust)
├── deploy-contracts.ps1        # Contract deployment scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/soroban-cli) (for contract deployment)
- A funded Stellar testnet account ([Friendbot](https://friendbot.stellar.org))

### Environment Variables

**Backend** (`app/backend/.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/mint2metal
JWT_SECRET=<your-jwt-secret>
STELLAR_ADMIN_SECRET=<G... keypair secret for XAG issuer>
TREASURY_PUBLIC_KEY=<G... Stellar public key of treasury account>
TREASURY_SECRET=<G... keypair secret of treasury account>
SUMSUB_APP_TOKEN=<sumsub-api-token>
SUMSUB_SECRET_KEY=<sumsub-secret>
ORACLE_SUBMITTER_SECRET=<G... oracle keypair secret>
ORACLE_CONTRACT_ID=<Soroban oracle contract ID>
PORT=4000
```

**Frontend** (`app/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/TejaKaranam792/mint2metal_v1.git
cd mint2metal_v1/app

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd backend && npm install && cd ..

# 4. Run database migrations
cd backend && npx prisma migrate deploy && cd ..

# 5. Start backend (port 4000)
cd backend && npm run dev

# 6. Start frontend (port 3000, separate terminal)
npm run dev
```

---

## 🔒 Security Design

- **Clawback Authority** — The XAG issuer account has `AUTH_CLAWBACK_ENABLED`, enabling recovery of tokens from sanctioned wallets without user consent, a requirement for tokenized commodity platforms in regulated jurisdictions
- **Oracle Circuit Breaker** — Emergency pause halts all price submissions to protect against oracle manipulation attacks
- **JWT + SEP-10 Dual Authentication** — Web2 users authenticated via JWT; Stellar wallet users authenticated via cryptographic SEP-10 challenge/response
- **Rate Limiting** — Per-request rate limiting at middleware level prevents DDoS and API abuse
- **AML Engine** — All redemption and trading activity is scored for suspicious patterns before settlement

---

## 🗺 Roadmap

| Milestone | Status |
|---|---|
| XAG Tokenization & Vault Management | ✅ Complete |
| Decentralized Oracle (Soroban) | ✅ Complete |
| KYC/AML via Sumsub | ✅ Complete |
| P2P Trading & Order Book | ✅ Complete |
| XAG-Collateralized Lending | ✅ Complete |
| Physical Redemption Pipeline | ✅ Complete |
| IPFS Proof-of-Reserve | ✅ Complete |
| SEP-10 / SEP-24 Anchor Protocol | ✅ Complete |
| B2B API with API Key Management | ✅ Complete |
| Mainnet Deployment | 🔜 Planned |
| Mobile App (React Native) | 🔜 Planned |
| Multi-Commodity (XAU - Gold Tokens) | 🔜 Planned |
| DEX Integration (Stellar AMM) | 🔜 Planned |

---

## 🤝 Contributing

We welcome contributions from the Stellar community! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feat/your-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

**Project Lead:** Teja Karanam  
**GitHub:** [@TejaKaranam792](https://github.com/TejaKaranam792)  
**Built on:** [Stellar](https://stellar.org) | [Soroban](https://soroban.stellar.org)

---

*Mint2Metal is currently deployed on Stellar Testnet. All XAG tokens and transactions during this phase are for demonstration and testing purposes only.*
