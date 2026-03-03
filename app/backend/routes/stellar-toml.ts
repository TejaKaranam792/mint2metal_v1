import { Router, Request, Response } from 'express';

const router = Router();

// Endpoint for stellar.toml
router.get('/stellar.toml', (req: Request, res: Response) => {
  const domain = process.env.ANCHOR_DOMAIN || "localhost:4000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  const toml = `
# Anchor Information
ACCOUNTS=["${process.env.TREASURY_PUBLIC_KEY || ''}"]
NETWORK_PASSPHRASE="${process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'}"

# SEP-10 Auth
WEB_AUTH_ENDPOINT="${protocol}://${domain}/auth"

# SEP-24 Interactive Flow
TRANSFER_SERVER_SEP0024="${protocol}://${domain}/sep24"

# Supported Currencies
[[CURRENCIES]]
code="USD"
desc="US Dollar equivalent for fiat deposits"
status="test"

[[CURRENCIES]]
code="XAG"
issuer="${process.env.ASSET_ISSUER || ''}"
desc="Tokenized Silver"
status="test"
  `.trim();

  res.header("Content-Type", "text/plain");
  res.send(toml);
});

export default router;
