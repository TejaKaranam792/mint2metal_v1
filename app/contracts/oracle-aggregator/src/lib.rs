#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, log, symbol_short,
    Address, BytesN, Env, Map, Symbol, Vec,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    CurrentPrice,     // i128 — price in micro-USD per gram (scaled by 1_000_000)
    LastTimestamp,    // u64  — Unix timestamp of last accepted price
    LastValidPrice,   // i128 — last accepted price (for deviation check)
    AnomalyCount,     // u32  — consecutive anomaly counter (circuit breaker)
    Submitters,       // Map<Address, bool>
    PendingPrices,    // Vec<i128> — up to 3 pending prices before quorum
    PendingCount,     // u32  — how many prices collected this round
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct OracleStatus {
    pub price_micro_usd_per_gram: i128, // price × 1_000_000
    pub last_timestamp: u64,
    pub is_paused: bool,
    pub anomaly_count: u32,
    pub pending_count: u32,
    pub is_stale: bool, // true if > 3600 seconds since last update
}

#[contracttype]
#[derive(Clone)]
pub struct PriceResult {
    pub price_micro_usd_per_gram: i128,
    pub last_timestamp: u64,
    pub is_stale: bool,
    pub is_paused: bool,
}

// ─── Events ──────────────────────────────────────────────────────────────────
// Events are emitted via env.events().publish()
// PriceUpdated  : (Symbol, i128 price, u64 timestamp)
// PriceRejected : (Symbol, Address submitter, i128 submitted, Symbol reason)
// OraclePaused  : (Symbol, u32 anomaly_count)

const PRICE_UPDATED: Symbol = symbol_short!("PriceUpd");
const PRICE_REJECTED: Symbol = symbol_short!("PriceRej");
const ORACLE_PAUSED: Symbol = symbol_short!("OrcPause");

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_DEVIATION_BPS: i128 = 500; // 5.00%
const STALE_THRESHOLD_SECS: u64 = 3600; // 1 hour
const ANOMALY_CIRCUIT_BREAK: u32 = 3; // pause after 3 consecutive anomalies
const QUORUM: u32 = 1; // 1 oracle now; expand to 3 for full quorum model
const SCALE: i128 = 1_000_000; // 6 decimal places

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct OracleAggregator;

#[contractimpl]
impl OracleAggregator {
    // ── Initialization ───────────────────────────────────────────────────────

    /// Initialize the oracle contract.
    /// `submitters` is the initial list of authorized oracle addresses.
    pub fn initialize(env: Env, admin: Address, submitters: Vec<Address>) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::AnomalyCount, &0u32);
        env.storage().instance().set(&DataKey::PendingCount, &0u32);
        env.storage().instance().set::<DataKey, Vec<i128>>(&DataKey::PendingPrices, &Vec::new(&env));

        // Register submitters
        let mut map: Map<Address, bool> = Map::new(&env);
        for s in submitters.iter() {
            map.set(s.clone(), true);
        }
        env.storage().instance().set(&DataKey::Submitters, &map);

        // Set a zero price initially so is_initialized-check works
        env.storage().instance().set(&DataKey::CurrentPrice, &0i128);
        env.storage().instance().set(&DataKey::LastValidPrice, &0i128);
        env.storage().instance().set(&DataKey::LastTimestamp, &0u64);

        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    // ── Price Submission ─────────────────────────────────────────────────────

    /// Submit an oracle price update.
    ///
    /// - `submitter`           : the authorized oracle address (must call this function)
    /// - `price_micro_usd_per_gram` : price of silver in micro-USD per gram (USD × 1_000_000)
    /// - `timestamp`           : Unix epoch seconds for this price observation
    ///
    /// Returns true if the price was accepted and finalized.
    pub fn submit_price(
        env: Env,
        submitter: Address,
        price_micro_usd_per_gram: i128,
        timestamp: u64,
    ) -> bool {
        // 1. Auth check
        submitter.require_auth();

        // 2. Not paused
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            log!(&env, "Oracle is paused");
            env.events().publish(
                (PRICE_REJECTED, submitter.clone()),
                (price_micro_usd_per_gram, symbol_short!("Paused")),
            );
            return false;
        }

        // 3. Submitter whitelist
        let submitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Submitters)
            .unwrap_or(Map::new(&env));
        if !submitters.get(submitter.clone()).unwrap_or(false) {
            panic!("Unauthorized: submitter not whitelisted");
        }

        // 4. Price sanity: must be positive
        if price_micro_usd_per_gram <= 0 {
            env.events().publish(
                (PRICE_REJECTED, submitter.clone()),
                (price_micro_usd_per_gram, symbol_short!("ZeroPrice")),
            );
            return false;
        }

        // 5. Stale timestamp check: reject if observation is older than threshold
        let now = env.ledger().timestamp();
        if timestamp < now && (now - timestamp) > STALE_THRESHOLD_SECS {
            Self::record_anomaly(&env);
            env.events().publish(
                (PRICE_REJECTED, submitter.clone()),
                (price_micro_usd_per_gram, symbol_short!("Stale")),
            );
            return false;
        }

        // 6. Deviation check against last valid price
        let last_valid: i128 = env
            .storage()
            .instance()
            .get(&DataKey::LastValidPrice)
            .unwrap_or(0);

        if last_valid > 0 {
            let deviation = Self::abs_deviation_bps(price_micro_usd_per_gram, last_valid);
            if deviation > MAX_DEVIATION_BPS {
                Self::record_anomaly(&env);
                env.events().publish(
                    (PRICE_REJECTED, submitter.clone()),
                    (price_micro_usd_per_gram, symbol_short!("Deviation")),
                );
                return false;
            }
        }

        // 7. Collect into pending prices for quorum
        let mut pending: Vec<i128> = env
            .storage()
            .instance()
            .get(&DataKey::PendingPrices)
            .unwrap_or(Vec::new(&env));
        pending.push_back(price_micro_usd_per_gram);

        let mut pending_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PendingCount)
            .unwrap_or(0);
        pending_count += 1;

        if pending_count >= QUORUM {
            // Compute median and finalize
            let median = Self::compute_median(&env, &pending);

            env.storage().instance().set(&DataKey::CurrentPrice, &median);
            env.storage().instance().set(&DataKey::LastValidPrice, &median);
            env.storage().instance().set(&DataKey::LastTimestamp, &timestamp);
            env.storage().instance().set(&DataKey::AnomalyCount, &0u32);

            // Reset pending
            env.storage().instance().set::<DataKey, Vec<i128>>(
                &DataKey::PendingPrices,
                &Vec::new(&env),
            );
            env.storage().instance().set(&DataKey::PendingCount, &0u32);

            env.events().publish((PRICE_UPDATED,), (median, timestamp));
            env.storage().instance().extend_ttl(100_000, 100_000);
            return true;
        } else {
            // Store partial collection
            env.storage().instance().set(&DataKey::PendingPrices, &pending);
            env.storage().instance().set(&DataKey::PendingCount, &pending_count);
            env.storage().instance().extend_ttl(100_000, 100_000);
            return false; // Not yet finalized
        }
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    /// Get the current oracle price.
    pub fn get_price(env: Env) -> PriceResult {
        let price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentPrice)
            .unwrap_or(0);
        let timestamp: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastTimestamp)
            .unwrap_or(0);
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        let now = env.ledger().timestamp();
        let is_stale = timestamp == 0 || (now > timestamp && (now - timestamp) > STALE_THRESHOLD_SECS);

        PriceResult {
            price_micro_usd_per_gram: price,
            last_timestamp: timestamp,
            is_stale,
            is_paused: paused,
        }
    }

    /// Get full oracle health status.
    pub fn get_status(env: Env) -> OracleStatus {
        let price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentPrice)
            .unwrap_or(0);
        let timestamp: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LastTimestamp)
            .unwrap_or(0);
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        let anomaly_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AnomalyCount)
            .unwrap_or(0);
        let pending_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PendingCount)
            .unwrap_or(0);
        let now = env.ledger().timestamp();
        let is_stale = timestamp == 0 || (now > timestamp && (now - timestamp) > STALE_THRESHOLD_SECS);

        OracleStatus {
            price_micro_usd_per_gram: price,
            last_timestamp: timestamp,
            is_paused: paused,
            anomaly_count,
            pending_count,
            is_stale,
        }
    }

    // ── Admin Functions ──────────────────────────────────────────────────────

    /// Emergency pause — stops all price submissions.
    pub fn emergency_pause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &true);
        let anomaly_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AnomalyCount)
            .unwrap_or(0);
        env.events().publish((ORACLE_PAUSED,), anomaly_count);
    }

    /// Unpause after inspection.
    pub fn unpause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::AnomalyCount, &0u32);
    }

    /// Add a new authorized price submitter.
    pub fn add_submitter(env: Env, new_submitter: Address) {
        Self::require_admin(&env);
        let mut submitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Submitters)
            .unwrap_or(Map::new(&env));
        submitters.set(new_submitter, true);
        env.storage().instance().set(&DataKey::Submitters, &submitters);
    }

    /// Remove a price submitter.
    pub fn remove_submitter(env: Env, submitter: Address) {
        Self::require_admin(&env);
        let mut submitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Submitters)
            .unwrap_or(Map::new(&env));
        submitters.remove(submitter);
        env.storage().instance().set(&DataKey::Submitters, &submitters);
    }

    /// Upgrade contract WASM.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    /// Increment anomaly counter. Auto-pause on threshold.
    fn record_anomaly(env: &Env) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AnomalyCount)
            .unwrap_or(0);
        let new_count = count + 1;
        env.storage()
            .instance()
            .set(&DataKey::AnomalyCount, &new_count);

        if new_count >= ANOMALY_CIRCUIT_BREAK {
            env.storage().instance().set(&DataKey::Paused, &true);
            env.events().publish((ORACLE_PAUSED,), new_count);
        }
    }

    /// Compute absolute deviation in basis points between two prices.
    fn abs_deviation_bps(new_price: i128, reference: i128) -> i128 {
        if reference == 0 {
            return 0;
        }
        let diff = if new_price > reference {
            new_price - reference
        } else {
            reference - new_price
        };
        // bps = diff / reference * 10000
        (diff * 10_000) / reference
    }

    /// Compute median of a Vec<i128> using simple insertion sort (small N).
    fn compute_median(env: &Env, prices: &Vec<i128>) -> i128 {
        let len = prices.len();
        if len == 0 {
            return 0;
        }
        if len == 1 {
            return prices.get(0).unwrap();
        }

        // Build a sorted copy via selection sort (no_std friendly, small N ≤ 3)
        let mut sorted: Vec<i128> = Vec::new(env);
        for i in 0..len {
            sorted.push_back(prices.get(i).unwrap());
        }

        // Bubble sort for small N
        for i in 0..len {
            for j in 0..(len - 1 - i) {
                let a = sorted.get(j).unwrap();
                let b = sorted.get(j + 1).unwrap();
                if a > b {
                    sorted.set(j, b);
                    sorted.set(j + 1, a);
                }
            }
        }

        let mid = len / 2;
        if len % 2 == 0 {
            // Even: average of two middle values
            let lo = sorted.get(mid - 1).unwrap();
            let hi = sorted.get(mid).unwrap();
            (lo + hi) / 2
        } else {
            sorted.get(mid).unwrap()
        }
    }
}
