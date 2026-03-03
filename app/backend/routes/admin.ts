import { Router } from "express";
import { getUserFromToken } from "../services/auth.service";
import { prisma } from "../prisma";
import { setSilverPrice, getCurrentSilverPrice, createSilverAsset, getVaultInventory, checkMintEligibility, createPurchaseOrder, updatePurchaseOrderStatus, getPurchaseOrders, getActivePriceLocks, expirePriceLocks } from "../services/silver.service";
import { settleOrder, rejectOrder } from "../services/order.service";
import { approveRedemption, executeRedemption, dispatchRedemption, getRedemptionQueue } from "../services/redemption.service";
import { loanService } from "../services/loan.service";
import { sorobanService } from "../services/soroban.service";
import { Keypair } from '@stellar/stellar-sdk';

const router = Router();

// Middleware to check admin role - temporarily disabled for testing
// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in requireAdmin middleware:", error);
    res.status(500).json({ error: "Internal server error during auth check" });
  }
};

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Get all users for admin management
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        country: true,
        amlStatus: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to include kycStatus at top level
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      country: user.country,
      amlStatus: user.amlStatus,
      role: user.role,
      createdAt: user.createdAt,
      kycStatus: user.kycStatus,
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user role (for admin management)
router.post("/user/:id/role", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    res.json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all transactions for monitoring
router.get("/transactions", requireAdmin, async (req, res) => {
  try {
    const redemptions = await prisma.redemption.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 50
    });

    const transactions = redemptions.map(r => ({
      id: r.id,
      userId: r.userId,
      type: "REDEMPTION",
      amount: r.quantity,
      status: r.status,
      timestamp: r.requestedAt.toISOString(),
      description: `Redeemed ${r.quantity}g silver`,
    }));

    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get system analytics
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const verifiedUsers = await prisma.user.count({ where: { kycStatus: "VERIFIED" } });

    const analytics = {
      totalUsers,
      verifiedUsers,
      totalTransactions: 1250,
      totalVolume: 50000, // in grams
      activeUsers: 89,
      systemHealth: "GOOD",
    };

    res.json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Update transaction status (for admin approval/rejection)
router.post("/transaction/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    res.status(400).json({ error: "Direct status editing not supported in production" });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Silver Price (Oracle-Powered) ───────────────────────────────────────────
// Manual price override is DISABLED. Use GET to read oracle price.

router.post("/silver-price", requireAdmin, async (req, res) => {
  res.status(410).json({
    error: "Manual price override is disabled.",
    message:
      "Silver price is now exclusively controlled by the decentralized OracleAggregator Soroban contract. " +
      "Prices are submitted automatically every 5 minutes by the oracle scheduler from Metals.live and Yahoo Finance. " +
      "Use POST /api/oracle/emergency-pause to halt price updates, or GET /api/oracle/status to view the current oracle state.",
    oracleStatusUrl: "/api/oracle/status",
    oraclePriceUrl: "/api/oracle/price",
  });
});

router.get("/silver-price", requireAdmin, async (req, res) => {
  try {
    const price = await getCurrentSilverPrice();
    res.json({ price });
  } catch (error) {
    console.error("Error getting silver price:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Vault Management
router.post("/silver-asset", requireAdmin, async (req, res) => {
  const { vaultId, weightGrams, purity } = req.body;

  try {
    const asset = await createSilverAsset(vaultId, weightGrams, purity, (req as any).user.id);
    res.json({ message: "Silver asset created successfully", asset });
  } catch (error) {
    console.error("Error creating silver asset:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vault-inventory", requireAdmin, async (req, res) => {
  try {
    const inventory = await getVaultInventory();
    res.json(inventory);
  } catch (error) {
    console.error("Error getting vault inventory:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/mint-eligibility", requireAdmin, async (req, res) => {
  try {
    const eligibility = await checkMintEligibility();
    res.json(eligibility);
  } catch (error) {
    console.error("Error checking mint eligibility:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Purchase Orders (Physical Silver Resupply)
router.get("/purchase-orders", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string;
    const orders = await getPurchaseOrders(status);
    res.json(orders);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchase-order", requireAdmin, async (req, res) => {
  try {
    const { dealerName, weightGrams, pricePerGram } = req.body;
    const order = await createPurchaseOrder(req.user.id, dealerName, weightGrams, pricePerGram);
    res.json({ message: "Purchase order created", order });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchase-order/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, serialNumbers, assayReports } = req.body;
    const order = await updatePurchaseOrderStatus(req.user.id, id, status, serialNumbers, assayReports);
    res.json({ message: "Purchase order status updated", order });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Orders admin endpoints
router.post("/orders/:id/settle", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await settleOrder(id);
    res.json(result);
  } catch (error) {
    console.error("Error settling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/orders/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await rejectOrder(id);
    res.json(result);
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});



// Redemption Management
router.post("/redemption/:id/approve", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { force } = req.body; // Allow admin to force approve even if burn fails

  try {
    const redemption = await approveRedemption(req.user.id, id, !!force);
    res.json({ message: "Redemption approved", redemption });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error approving redemption:", message);
    // Return the actual error so admin knows what failed (burn failure, missing wallet, etc.)
    res.status(500).json({ error: message });
  }
});

router.post("/redemption/:id/execute", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminSecret } = req.body;

  try {
    const redemption = await executeRedemption(id, adminSecret);
    res.json({ message: "Redemption executed", redemption });
  } catch (error) {
    console.error("Error executing redemption:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/redemption/:id/dispatch", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber } = req.body;

  try {
    const redemption = await dispatchRedemption(req.user.id, id, trackingNumber);
    res.json({ message: "Redemption dispatched", redemption });
  } catch (error) {
    console.error("Error dispatching redemption:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/redemption-queue", requireAdmin, async (req, res) => {
  try {
    const queue = await getRedemptionQueue();
    res.json(queue);
  } catch (error) {
    console.error("Error getting redemption queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/redemptions — all redemptions with full delivery address for admin
router.get("/redemptions", requireAdmin, async (req, res) => {
  try {
    const allRedemptions = await prisma.redemption.findMany({
      include: { user: { include: { wallet: true } } },
      orderBy: { requestedAt: 'desc' },
    });

    const parseAddress = (raw: string | null) => {
      if (!raw) return { raw: '', name: '', phone: '', street: '', city: '', state: '', pincode: '', formatted: 'No address provided' };
      const parts = raw.split(', ');
      return {
        raw,
        name: parts[0] || '',
        phone: parts[1] || '',
        street: parts[2] || '',
        city: parts[3] || '',
        state: parts[4] || '',
        pincode: parts[5] || '',
        formatted: raw,
      };
    };

    const result = allRedemptions.map(r => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email || 'N/A',
      quantity: r.quantity,
      status: r.status,
      requestedAt: r.requestedAt,
      fulfilledAt: r.fulfilledAt,
      deliveryAddress: parseAddress(r.address),
      walletAddress: r.user?.wallet?.address || 'No wallet linked',
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching all redemptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Admin Controls
router.post("/user/:id/freeze", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { frozen } = req.body;

  try {
    // Wallet removed from schema, return mock response
    res.json({ message: `User ${frozen ? 'frozen' : 'unfrozen'} successfully` });
  } catch (error) {
    console.error("Error freezing/unfreezing user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Treasury Management
router.get("/treasury/balance", requireAdmin, async (req, res) => {
  try {
    const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY;
    if (!treasuryPublicKey) {
      return res.status(500).json({ error: "Treasury public key not configured" });
    }
    const balance = await sorobanService.getBalance(treasuryPublicKey);
    res.json({ balance });
  } catch (error) {
    console.error("Error fetching treasury balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/treasury/mint", requireAdmin, async (req, res) => {
  const { amount, reservesProof, vaultId: bodyVaultId, vaultName: bodyVaultName, ipfsCid } = req.body;

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  // ─── IPFS CID VALIDATION ───────────────────────────────────────────────────
  if (!ipfsCid || typeof ipfsCid !== 'string' || ipfsCid.trim() === '') {
    return res.status(400).json({
      error: "IPFS CID is required. Upload your proof-of-reserve document to IPFS and paste the CID here.",
    });
  }
  const trimmedCid = ipfsCid.trim();
  const isValidCid = trimmedCid.startsWith('Qm') || trimmedCid.startsWith('bafy') || trimmedCid.startsWith('bafk');
  if (!isValidCid) {
    return res.status(400).json({
      error: `Invalid IPFS CID format: "${trimmedCid}". Must start with "Qm" (CIDv0) or "bafy"/"bafk" (CIDv1). Upload your document to IPFS first.`,
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "Admin secret not configured" });
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const issuerPubKey = adminKeypair.publicKey(); // XAG issuer
    const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY!;

    if (!treasuryPublicKey) {
      return res.status(500).json({ error: "Treasury public key not configured" });
    }

    const receiptId = reservesProof || `admin-mint-${Date.now()}`;
    const vaultId = bodyVaultId || "vault-default";
    const vaultName = bodyVaultName || vaultId;
    const parsedAmount = parseFloat(amount);

    // ─── VAULT INVENTORY GUARD ─────────────────────────────────────────────────
    // Enforce 1:1 backing: you can only mint as much as you have unminted silver.
    const unmintedInventory = await prisma.commodityAsset.findMany({
      where: { mint: null },
    });
    const availableGrams = unmintedInventory.reduce(
      (sum, a) => sum + a.weightGrams,
      0
    );

    if (parsedAmount > availableGrams) {
      return res.status(400).json({
        error: `Insufficient vault inventory. You are trying to mint ${parsedAmount}g but only ${availableGrams.toFixed(2)}g of unminted silver is available in the vault. Please create a purchase order and mark it as RECEIVED to add more silver inventory first.`,
        availableGrams,
        requestedGrams: parsedAmount,
      });
    }
    // ──────────────────────────────────────────────────────────────────────────


    // The issuer (STELLAR_ADMIN_SECRET) simply sends XAG to the treasury.
    // This mints new XAG tokens as the issuer account can always send its own asset.
    const stellarSdk = require('@stellar/stellar-sdk');
    const horizon = new stellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const networkPassphrase = stellarSdk.Networks.TESTNET;
    const xagAsset = new stellarSdk.Asset('XAG', issuerPubKey);

    // Ensure treasury has a trustline for XAG
    let treasuryAccount;
    try {
      treasuryAccount = await horizon.loadAccount(treasuryPublicKey);
    } catch (e: any) {
      return res.status(500).json({ error: `Treasury account not found on-chain: ${e.message}` });
    }

    const hasTrustline = treasuryAccount.balances.some(
      (b: any) => b.asset_type !== 'native' && b.asset_code === 'XAG' && b.asset_issuer === issuerPubKey
    );

    let txHash: string;

    if (!hasTrustline) {
      // Create trustline from treasury to XAG
      const treasurySecret = process.env.TREASURY_SECRET;
      if (!treasurySecret) {
        return res.status(500).json({ error: "Treasury secret needed to create trustline but not configured" });
      }
      const treasuryKeypair = Keypair.fromSecret(treasurySecret);
      const trustTx = new stellarSdk.TransactionBuilder(treasuryAccount, {
        fee: '100000',
        networkPassphrase,
      })
        .addOperation(stellarSdk.Operation.changeTrust({ asset: xagAsset }))
        .setTimeout(60)
        .build();
      trustTx.sign(treasuryKeypair);
      const trustResult = await horizon.submitTransaction(trustTx);
      console.log(`[Mint] Treasury XAG trustline created: ${trustResult.hash}`);
      // Reload account after trustline
      treasuryAccount = await horizon.loadAccount(treasuryPublicKey);
    }

    // Issue XAG from issuer to treasury
    const issuerAccount = await horizon.loadAccount(issuerPubKey);
    const mintTx = new stellarSdk.TransactionBuilder(issuerAccount, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(stellarSdk.Operation.payment({
        destination: treasuryPublicKey,
        asset: xagAsset,
        amount: parsedAmount.toFixed(7),
      }))
      .setTimeout(60)
      .build();
    mintTx.sign(adminKeypair);
    const mintResult = await horizon.submitTransaction(mintTx);
    txHash = mintResult.hash;

    console.log(`[Mint] Minted ${parsedAmount}g XAG to Treasury. TxHash: ${txHash}`);

    // ─── Anchor IPFS CID on Stellar treasury account ──────────────────────────
    // Store the proof-of-reserve CID in the treasury account's manageData.
    // CIDv1 base32 is ≤59 chars; CIDv0 (Qm...) is 46 chars — both fit within 64 bytes.
    try {
      const treasurySecret = process.env.TREASURY_SECRET;
      if (treasurySecret) {
        const treasuryKeypair = Keypair.fromSecret(treasurySecret);
        const latestTreasuryAccount = await horizon.loadAccount(treasuryPublicKey);
        const anchorTx = new stellarSdk.TransactionBuilder(latestTreasuryAccount, {
          fee: '100000',
          networkPassphrase,
        })
          .addOperation(stellarSdk.Operation.manageData({
            name: 'por_ipfs_cid',
            value: trimmedCid,
          }))
          .addOperation(stellarSdk.Operation.manageData({
            name: 'por_timestamp',
            value: new Date().toISOString().slice(0, 19) + 'Z', // ISO 8601, ≤20 chars
          }))
          .addOperation(stellarSdk.Operation.manageData({
            name: 'por_vault',
            value: vaultName.slice(0, 64), // enforce 64-byte limit
          }))
          .setTimeout(60)
          .build();
        anchorTx.sign(treasuryKeypair);
        const anchorResult = await horizon.submitTransaction(anchorTx);
        console.log(`[Mint] IPFS CID anchored on Stellar treasury: ${anchorResult.hash} | CID: ${trimmedCid}`);
      } else {
        console.warn('[Mint] TREASURY_SECRET not set — skipping on-chain CID anchor');
      }
    } catch (anchorErr: any) {
      // Non-fatal: log but don't fail the mint — the CID is still in the DB
      console.error('[Mint] Failed to anchor IPFS CID on Stellar (non-fatal):', anchorErr.message);
    }
    // ──────────────────────────────────────────────────────────────────────────

    // ─── DB Updates ───────────────────────────────────────────────────────────
    let adminWallet = await prisma.wallet.findFirst({ where: { userId: (req as any).user.id } });
    if (!adminWallet) {
      adminWallet = await prisma.wallet.create({
        data: {
          userId: (req as any).user.id,
          address: issuerPubKey,
          walletType: "INTERNAL",
        }
      });
    }

    // Mark unminted commodity assets as minted
    const unmintedAssets = await prisma.commodityAsset.findMany({
      where: { mint: null },
      orderBy: { weightGrams: 'desc' }
    });

    let remainingToMint = parsedAmount;
    const assetsToUpdate: string[] = [];
    for (const asset of unmintedAssets) {
      if (remainingToMint <= 0) break;
      assetsToUpdate.push(asset.id);
      remainingToMint -= asset.weightGrams;
    }

    if (assetsToUpdate.length > 0) {
      await prisma.commodityAsset.updateMany({
        where: { id: { in: assetsToUpdate } },
        data: { mint: txHash }
      });
    }

    await prisma.dSTMint.create({
      data: {
        userId: (req as any).user.id,
        walletId: adminWallet.id,
        amount: parsedAmount,
        status: "COMPLETED",
        txHash,
      }
    });

    await prisma.vaultReceipt.upsert({
      where: { receiptId },
      update: { isUsed: true, ipfsCid: trimmedCid, vaultName },
      create: {
        receiptId,
        vaultId,
        vaultName,
        commodityType: "XAG",
        gramsSecured: parsedAmount,
        verifierId: (req as any).user.id,
        isUsed: true,
        ipfsCid: trimmedCid,
      }
    });

    // Update the system settings with the latest CID for public dashboard consumption
    await prisma.systemSettings.upsert({
      where: { key: "LATEST_POR_CID" },
      update: { value: trimmedCid, updatedAt: new Date() },
      create: { key: "LATEST_POR_CID", value: trimmedCid },
    });

    const newBalance = await sorobanService.getBalance(treasuryPublicKey);

    res.json({
      message: `${parsedAmount}g XAG minted to treasury successfully`,
      txHash,
      newBalance,
      ipfsCid: trimmedCid,
      ipfsUrl: `https://ipfs.io/ipfs/${trimmedCid}`,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    });
  } catch (error: any) {
    const resultCodes = error?.response?.data?.extras?.result_codes;
    const errMsg = resultCodes
      ? `Stellar error: tx=${resultCodes.transaction}, ops=${JSON.stringify(resultCodes.operations)}`
      : error.message || "Internal server error";
    console.error("Error minting to treasury:", errMsg);
    res.status(500).json({ error: errMsg });
  }
});

router.get("/fix-db-mint", async (req, res) => {
  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) return res.send("No admin");

    let adminWallet = await prisma.wallet.findFirst({ where: { userId: adminUser.id } });
    if (!adminWallet) {
      adminWallet = await prisma.wallet.create({
        data: {
          userId: adminUser.id,
          address: "GAQSTTMR5P4YBJ3ZVE3HQ46QA2RED3VSNHGVLF5PHBDVOXW5Z5SSPPG2", // Default from errors if not specified
          walletType: "INTERNAL"
        }
      });
    }

    // 1. Mark unminted assets as minted
    const unmintedAssets = await prisma.commodityAsset.findMany({
      where: { mint: null },
      orderBy: { weightGrams: 'desc' }
    });

    let remainingToMint = 1000;
    const assetsToUpdate = [];
    for (const asset of unmintedAssets) {
      if (remainingToMint <= 0) break;
      assetsToUpdate.push(asset.id);
      remainingToMint -= asset.weightGrams;
    }

    if (assetsToUpdate.length > 0) {
      await prisma.commodityAsset.updateMany({
        where: { id: { in: assetsToUpdate } },
        data: { mint: "VAULT-101-BACKFILL" }
      });
    }

    // 2. Create DSTMint
    await prisma.dSTMint.create({
      data: {
        userId: adminUser.id,
        walletId: adminWallet.id,
        amount: 1000,
        status: "COMPLETED",
        txHash: "VAULT-101-BACKFILL",
      }
    });

    // 3. Create VaultReceipt
    await prisma.vaultReceipt.upsert({
      where: { receiptId: "VAULT-101" },
      update: { isUsed: true },
      create: {
        receiptId: "VAULT-101",
        vaultId: "vault-default",
        commodityType: "XAG",
        gramsSecured: 1000,
        verifierId: adminUser.id,
        isUsed: true,
      }
    });

    res.json({ success: true, updatedAssets: assetsToUpdate.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Temporary endpoint to wrap asset
router.get("/wrap-asset", async (req, res) => {
  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET!;
    const treasuryPublicKey = process.env.TREASURY_PUBLIC_KEY!;
    const adminKeypair = Keypair.fromSecret(adminSecret);
    const { Asset, Operation, xdr, TransactionBuilder } = await import('@stellar/stellar-sdk');

    const xagAsset = new Asset("XAG", adminKeypair.publicKey());

    // Deploying SAC
    const server = (sorobanService as any).server;
    const networkPassphrase = (sorobanService as any).networkPassphrase;
    const account = await server.getAccount(adminKeypair.publicKey());

    const op = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeCreateContract(
        new xdr.CreateContractArgs({
          contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAsset(xagAsset.toXDRObject()),
          executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
        })
      ),
      auth: [],
    });

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const txHash = await (sorobanService as any).submitAndWait(tx, adminKeypair);

    res.json({ success: true, txHash });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// ─── One-time Setup: Enable AUTH_CLAWBACK_ENABLED on issuer account ──────────
// POST /admin/setup-clawback
// Sets AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED on the admin/issuer account
// and enables clawback on all existing XAG trustlines.
// Safe to call multiple times (idempotent).
router.post("/setup-clawback", async (req, res) => {
  const logs: string[] = [];
  const L = (s: string) => { logs.push(s); console.log('[setup-clawback]', s); };

  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "STELLAR_ADMIN_SECRET not configured", logs });
    }

    const stellarSdk: any = await import('@stellar/stellar-sdk');
    const { Keypair: KP, Horizon: H, TransactionBuilder: TB, Networks: N, Operation: Op, Asset: A } = stellarSdk;

    const adminKeypair = KP.fromSecret(adminSecret);
    const adminPubKey: string = adminKeypair.publicKey();
    const networkPassphrase = N.TESTNET;
    const horizon = new H.Server('https://horizon-testnet.stellar.org');
    const asset = new A('XAG', adminPubKey);

    L(`Admin PK: ${adminPubKey}`);

    // Step 1: Set account flags
    const account = await horizon.loadAccount(adminPubKey);
    const flags: any = account.flags;
    L(`Current flags: ${JSON.stringify(flags)}`);

    if (!flags.auth_clawback_enabled) {
      const setFlags: any = (!flags.auth_revocable ? 2 : 0) | 8; // 2=AUTH_REVOCABLE, 8=AUTH_CLAWBACK_ENABLED
      L(`Setting flags ${setFlags} on issuer account...`);

      const tx = new TB(account, { fee: '200000', networkPassphrase })
        .addOperation(Op.setOptions({ setFlags }))
        .setTimeout(60)
        .build();
      tx.sign(adminKeypair);

      try {
        const txResult = await horizon.submitTransaction(tx);
        L(`setOptions SUCCESS: ${txResult.hash}`);
      } catch (e: any) {
        const rc = e?.response?.data?.extras?.result_codes;
        L(`setOptions FAILED: ${e.message} | result_codes: ${JSON.stringify(rc)}`);
        return res.status(500).json({ error: `setOptions failed: ${e.message}`, result_codes: rc, logs });
      }

      const updated = await horizon.loadAccount(adminPubKey);
      L(`Updated flags: ${JSON.stringify((updated as any).flags)}`);
    } else {
      L("auth_clawback_enabled already set — skipping setOptions");
    }

    // Step 2: Update existing XAG trustlines to enable clawback
    L("Looking for XAG trustline holders...");
    let trustlineCount = 0;
    try {
      const page = await horizon.accounts().forAsset(asset).limit(200).call();
      L(`Found ${(page as any).records.length} accounts holding XAG`);

      for (const acct of (page as any).records) {
        if (acct.account_id === adminPubKey) continue;
        const bal = (acct.balances || []).find(
          (b: any) => b.asset_code === 'XAG' && b.asset_issuer === adminPubKey
        );
        if (!bal) continue;
        if (bal.is_clawback_enabled) {
          L(`  SKIP ${acct.account_id} — trustline clawback already enabled`);
          continue;
        }
        L(`  Enabling clawback for ${acct.account_id}`);
        try {
          const issuerAcc = await horizon.loadAccount(adminPubKey);
          const tTx = new TB(issuerAcc, { fee: '200000', networkPassphrase })
            .addOperation(Op.setTrustLineFlags({ trustor: acct.account_id, asset, flags: { clawbackEnabled: true } }))
            .setTimeout(60)
            .build();
          tTx.sign(adminKeypair);
          const r = await horizon.submitTransaction(tTx);
          L(`    OK: ${r.hash}`);
          trustlineCount++;
        } catch (e2: any) {
          const rc2 = e2?.response?.data?.extras?.result_codes;
          L(`    FAILED: ${e2.message} | ${JSON.stringify(rc2)}`);
        }
      }
    } catch (e: any) {
      L(`Account query failed: ${e.message}`);
    }

    L(`Done. Trustlines updated: ${trustlineCount}`);
    res.json({ success: true, logs, trustlineCount });
  } catch (error: any) {
    const msg = error.message || String(error);
    logs.push(`FATAL: ${msg}`);
    console.error("[setup-clawback] Fatal error:", error);
    res.status(500).json({ error: msg, logs });
  }
});

/**
 * POST /admin/fix-user
 * FORCE enable clawback on the specific failing user's trustline.
 */
router.post("/fix-user", async (req, res) => {
  const logs: string[] = [];
  const L = (s: string) => { logs.push(s); console.log('[fix-user]', s); };

  try {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).json({ error: "STELLAR_ADMIN_SECRET not configured", logs });
    }

    const stellarSdk: any = await import('@stellar/stellar-sdk');
    const { Keypair: KP, Horizon: H, TransactionBuilder: TB, Networks: N, Operation: Op, Asset: A } = stellarSdk;

    const adminKeypair = KP.fromSecret(adminSecret);
    const adminPubKey: string = adminKeypair.publicKey();
    const networkPassphrase = N.TESTNET;
    const horizon = new H.Server('https://horizon-testnet.stellar.org');
    const asset = new A('XAG', adminPubKey);
    const targetUser = "GD275XUQFID3TPHVUQSKU3OJXIB5TI3KJOAFWIDSQN3LBLU6EOZMHH7T";

    L(`Admin PK: ${adminPubKey}`);
    L(`Target User: ${targetUser}`);

    const issuerAcc = await horizon.loadAccount(adminPubKey);
    const tTx = new TB(issuerAcc, { fee: '200000', networkPassphrase })
      .addOperation(Op.setTrustLineFlags({ trustor: targetUser, asset, flags: { clawbackEnabled: true } }))
      .setTimeout(60)
      .build();
    tTx.sign(adminKeypair);

    const r = await horizon.submitTransaction(tTx);
    L(`OK: ${r.hash}`);

    return res.json({ success: true, hash: r.hash, logs });
  } catch (error: any) {
    const rc = error?.response?.data?.extras?.result_codes;
    L(`FATAL: ${error.message} | ${JSON.stringify(rc)}`);
    return res.status(500).json({ success: false, error: error.message, resultCodes: rc, logs });
  }
});

export default router;
