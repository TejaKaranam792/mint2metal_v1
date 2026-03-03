#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, String, Symbol, BytesN};
use soroban_sdk::token::StellarAssetClient;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Role(Address),
    Frozen(Address),
    Registry(Symbol),
    Receipt(String),
    FeeConfig,
    Paused,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum UserRole {
    Admin,
    Operator,
    User,
    CustodyVerifier,
    MintExecutor,
    TreasuryAdmin,
    Issuer,
}

#[contracttype]
#[derive(Clone)]
pub struct AssetClass {
    pub commodity_type: Symbol,
    pub token_address: Address,
    pub unit_weight: u32,
    pub purity: u32,
    pub vault_id: String,
    pub oracle_source: String,
    pub issuer_id: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct VaultReceipt {
    pub receipt_id: String,
    pub vault_id: String,
    pub asset_class: Symbol,
    pub amount_grams: u64,
    pub custody_hash: String,
    pub verifier: Address,
    pub is_used: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct FeeConfig {
    pub issuance_fee_bps: u32,
    pub storage_fee_bps: u32,
    pub redemption_fee_bps: u32,
    pub platform_fee_bps: u32,
}

#[contract]
pub struct CommodityProtocol;

#[contractimpl]
impl CommodityProtocol {
    /// Initialize the contract with admin
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);

        // Set admin role
        env.storage().instance().set(&DataKey::Role(admin.clone()), &UserRole::Admin);

        // Default Fee Config
        let fees = FeeConfig {
            issuance_fee_bps: 0,
            storage_fee_bps: 0,
            redemption_fee_bps: 0,
            platform_fee_bps: 0,
        };
        env.storage().instance().set(&DataKey::FeeConfig, &fees);
    }

    /// Register a new asset class mapped to a Native Stellar Asset (via SAC wrapper address)
    pub fn register_asset_class(
        env: Env,
        commodity_type: Symbol,
        token_address: Address,
        unit_weight: u32,
        purity: u32,
        vault_id: String,
        oracle_source: String,
        issuer_id: Address,
    ) {
        Self::require_admin(&env);
        
        let asset = AssetClass {
            commodity_type: commodity_type.clone(),
            token_address,
            unit_weight,
            purity,
            vault_id,
            oracle_source,
            issuer_id,
        };
        
        env.storage().instance().set(&DataKey::Registry(commodity_type.clone()), &asset);
        env.events().publish(("asset_registered", commodity_type), ());
    }

    /// Get asset class details
    pub fn get_asset_class(env: Env, commodity_type: Symbol) -> AssetClass {
        env.storage().instance().get(&DataKey::Registry(commodity_type)).unwrap()
    }

    /// Submit a custody vault receipt (CustodyVerifier only)
    pub fn submit_raw_receipt(
        env: Env,
        verifier: Address,
        receipt_id: String,
        vault_id: String,
        asset_class: Symbol,
        amount_grams: u64,
        custody_hash: String,
    ) {
        verifier.require_auth();
        let role = Self::get_role(env.clone(), verifier.clone());
        if role != UserRole::CustodyVerifier && role != UserRole::Admin {
            panic!("Unauthorized: Must be CustodyVerifier or Admin");
        }

        let receipt = VaultReceipt {
            receipt_id: receipt_id.clone(),
            vault_id,
            asset_class: asset_class.clone(),
            amount_grams,
            custody_hash: custody_hash.clone(),
            verifier,
            is_used: false,
        };

        env.storage().instance().set(&DataKey::Receipt(receipt_id.clone()), &receipt);
        env.events().publish(("receipt_submitted", receipt_id, asset_class, amount_grams), ());
    }

    /// Mint tokens backed strictly by verified physical custody using SAC
    pub fn mint_with_custody(env: Env, executor: Address, receipt_id: String, to: Address) {
        Self::require_not_paused(&env);
        executor.require_auth();
        let role = Self::get_role(env.clone(), executor.clone());
        if role != UserRole::MintExecutor && role != UserRole::Admin {
            panic!("Unauthorized: Must be MintExecutor or Admin");
        }

        // 1. Validate Custody Receipt
        let mut receipt: VaultReceipt = env.storage().instance().get(&DataKey::Receipt(receipt_id.clone())).expect("Receipt not found");
        if receipt.is_used {
            panic!("Receipt already used for minting");
        }
        
        // 2. Validate Asset exists
        let asset: AssetClass = env.storage().instance().get(&DataKey::Registry(receipt.asset_class.clone())).expect("Asset not registered");

        // 3. Mark Receipt as used
        receipt.is_used = true;
        env.storage().instance().set(&DataKey::Receipt(receipt_id.clone()), &receipt);

        // 4. Mint directly via the Stellar Asset Contract
        let amount_i128 = receipt.amount_grams as i128;
        let sac_client = StellarAssetClient::new(&env, &asset.token_address);
        
        // As the admin of the SAC, we have the authority to call `mint`
        sac_client.mint(&to, &amount_i128);

        env.events().publish(("mint_with_custody", to, asset.commodity_type, receipt.amount_grams, receipt.custody_hash), ());
    }

    /* GOVERNANCE & UTILITY FUNCTIONS */

    pub fn set_freeze(env: Env, address: Address, frozen: bool) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Frozen(address.clone()), &frozen);
        env.events().publish(("freeze", address, frozen), ());
    }

    pub fn is_frozen(env: Env, address: Address) -> bool {
        env.storage().instance().get(&DataKey::Frozen(address)).unwrap_or(false)
    }

    pub fn set_role(env: Env, address: Address, role: UserRole) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Role(address.clone()), &role);
        env.events().publish(("role_changed", address, role), ());
    }

    pub fn get_role(env: Env, address: Address) -> UserRole {
        env.storage().instance().get(&DataKey::Role(address)).unwrap_or(UserRole::User)
    }

    pub fn update_fees(env: Env, issuance_bps: u32, storage_bps: u32, redemption_bps: u32, platform_bps: u32) {
        Self::require_admin(&env);
        let fees = FeeConfig {
            issuance_fee_bps: issuance_bps,
            storage_fee_bps: storage_bps,
            redemption_fee_bps: redemption_bps,
            platform_fee_bps: platform_bps,
        };
        env.storage().instance().set(&DataKey::FeeConfig, &fees);
        env.events().publish(("fees_updated", issuance_bps, storage_bps, redemption_bps, platform_bps), ());
    }

    pub fn get_fees(env: Env) -> FeeConfig {
        env.storage().instance().get(&DataKey::FeeConfig).unwrap()
    }

    pub fn set_paused(env: Env, paused: bool) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        env.events().publish(("paused", paused), ());
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn require_not_paused(env: &Env) {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("Protocol is currently paused");
        }
    }
}
