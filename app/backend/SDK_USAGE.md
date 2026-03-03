# Mint2Metal B2B Partner API — Developer Reference

**Base URL:** `https://api.mint2metal.com` (or `http://localhost:4000` for local)

**Authentication:** Pass your API key in every request header:
```
x-api-key: m2m_<your_secret_key>
```

---

## Permissions

When generating an API key, choose the right permissions:

| Permission | Access |
|---|---|
| `READ_ONLY` | Market data, vault status, portfolio queries |
| `TRADE` | Place buy/sell orders, price locks, redemptions |
| `FULL_ACCESS` | Everything above |

---

## Endpoints

### 1. Market Data

#### `GET /b2b/silver-price`
Returns the current M2M price per gram of silver.

**Permission:** `READ_ONLY`

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-28T07:00:00Z",
  "data": {
    "pricePerGram": 85.50,
    "currency": "M2M",
    "commodityType": "XAG",
    "setAt": "2026-02-28T06:00:00Z"
  }
}
```

---

#### `GET /b2b/vault-status`
Returns vault inventory: assets, total weight, total value.

**Permission:** `READ_ONLY`

**Response:**
```json
{
  "success": true,
  "data": {
    "assets": [...],
    "totalWeight": 500.0,
    "totalValue": 42750.0,
    "count": 12
  }
}
```

---

#### `GET /b2b/treasury-balance`
Returns on-chain Stellar treasury balance.

**Permission:** `READ_ONLY`

---

### 2. Trading

#### `POST /b2b/buy`
Place a buy order for silver.

**Permission:** `TRADE`

**Request Body:**
```json
{ "quantityGrams": 10 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid-...",
    "type": "BUY",
    "quantityGrams": 10,
    "priceLocked": 85.50,
    "currency": "M2M",
    "totalCost": 855.00,
    "status": "PENDING",
    "createdAt": "2026-02-28T07:00:00Z"
  }
}
```

---

#### `POST /b2b/sell`
Place a sell order (requires sufficient DST balance).

**Permission:** `TRADE`

**Request Body:**
```json
{ "quantityGrams": 5 }
```

**Response:** Same shape as `/b2b/buy` with `type: "SELL"` and `totalValue`.

---

#### `POST /b2b/price-lock`
Lock the current price for up to 60 minutes, guaranteeing that rate for order execution.

**Permission:** `TRADE`

**Request Body:**
```json
{ "lockDurationMinutes": 15 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lockId": "uuid-...",
    "lockedPrice": 85.50,
    "currency": "M2M",
    "lockedAt": "...",
    "expiresAt": "...",
    "validForMinutes": 15
  }
}
```

---

### 3. Order Management

#### `GET /b2b/orders`
List your orders. Optional query params: `?type=BUY|SELL`, `?status=PENDING|SETTLED|REJECTED`, `?limit=50`

**Permission:** `READ_ONLY`

---

#### `GET /b2b/orders/:id`
Get a single order by ID, including current vs. locked price comparison.

**Permission:** `READ_ONLY`

---

### 4. Portfolio

#### `GET /b2b/portfolio`
Returns wallet balance, DST valuation, trade summary, and recent orders.

**Permission:** `READ_ONLY`

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "address": "GABCDE...",
      "dstBalance": 100,
      "estimatedValueM2M": 8550,
      "chain": "Stellar"
    },
    "pricePerGram": 85.50,
    "summary": {
      "totalBoughtGrams": 150,
      "totalSoldGrams": 50,
      "netHoldings": 100,
      "pendingOrders": 2
    },
    "recentOrders": [...]
  }
}
```

---

### 5. Redemption

#### `POST /b2b/redeem`
Submit a request to redeem DST tokens for physical silver delivery.

**Permission:** `TRADE`

**Request Body:**
```json
{
  "quantityGrams": 10,
  "deliveryAddress": "123 Main Street, Mumbai, India 400001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redemptionId": "uuid-...",
    "quantityGrams": 10,
    "deliveryAddress": "...",
    "status": "REQUESTED",
    "requestedAt": "...",
    "message": "Redemption request submitted. Our team will process it within 3-5 business days."
  }
}
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `401` | Missing or invalid API key |
| `403` | Your key lacks the required permission |
| `400` | Invalid request body |
| `503` | Silver price not yet configured by admin |
| `500` | Internal server error |

---

## Rate Limits

Each API key has a rate limit (default: 100 requests/minute). Exceeding it returns `429 Too Many Requests`.
