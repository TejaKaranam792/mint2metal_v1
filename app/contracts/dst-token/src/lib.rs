#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalSupply,
    Balance(Address),
    Role(Address),
    Frozen(Address),
    ReservesProof,
}

#[contracttype]
#[derive(Clone)]
pub struct ReservesData {
    pub proof_hash: String,
    pub total_silver_grams: u64,
    pub timestamp: u64,
}

#[contracttype]
pub enum UserRole {
    Admin,
    Operator,
    User,
}

#[contract]
pub struct DSTToken;

#[contractimpl]
impl DSTToken {
    /// Initialize the contract with admin
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);

        // Set admin role
        env.storage().instance().set(&DataKey::Role(admin.clone()), &UserRole::Admin);

        // Initialize reserves proof
        let initial_reserves = ReservesData {
            proof_hash: String::from_str(&env, ""),
            total_silver_grams: 0,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::ReservesProof, &initial_reserves);
    }

    /// Mint tokens (admin only)
    pub fn mint(env: Env, to: Address, amount: u64, reserves_proof: String) {
        Self::require_admin(&env);

        let mut total_supply: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let mut balance: u64 = env.storage().instance().get(&DataKey::Balance(to.clone())).unwrap_or(0);

        // Check if user is frozen
        if Self::is_frozen(env.clone(), to.clone()) {
            panic!("Account is frozen");
        }

        total_supply += amount;
        balance += amount;

        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);
        env.storage().instance().set(&DataKey::Balance(to.clone()), &balance);

        // Update reserves proof
        let reserves_data = ReservesData {
            proof_hash: reserves_proof,
            total_silver_grams: total_supply, // Assuming 1:1 ratio for simplicity
            timestamp: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::ReservesProof, &reserves_data);

        env.events().publish(("mint", to, amount), ());
    }

    /// Burn tokens (admin only)
    pub fn burn(env: Env, from: Address, amount: u64) {
        Self::require_admin(&env);

        let mut total_supply: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let mut balance: u64 = env.storage().instance().get(&DataKey::Balance(from.clone())).unwrap_or(0);

        if balance < amount {
            panic!("Insufficient balance");
        }

        total_supply -= amount;
        balance -= amount;

        env.storage().instance().set(&DataKey::TotalSupply, &total_supply);
        env.storage().instance().set(&DataKey::Balance(from.clone()), &balance);

        env.events().publish(("burn", from, amount), ());
    }

    /// Transfer tokens between users
    pub fn transfer(env: Env, from: Address, to: Address, amount: u64) {
        from.require_auth();

        // Check if sender is frozen
        if Self::is_frozen(env.clone(), from.clone()) {
            panic!("Sender account is frozen");
        }

        // Check if receiver is frozen
        if Self::is_frozen(env.clone(), to.clone()) {
            panic!("Receiver account is frozen");
        }

        let mut from_balance: u64 = env.storage().instance().get(&DataKey::Balance(from.clone())).unwrap_or(0);
        let mut to_balance: u64 = env.storage().instance().get(&DataKey::Balance(to.clone())).unwrap_or(0);

        if from_balance < amount {
            panic!("Insufficient balance");
        }

        from_balance -= amount;
        to_balance += amount;

        env.storage().instance().set(&DataKey::Balance(from.clone()), &from_balance);
        env.storage().instance().set(&DataKey::Balance(to.clone()), &to_balance);

        env.events().publish(("transfer", from, to, amount), ());
    }

    /// Get balance of an address
    pub fn balance(env: Env, address: Address) -> u64 {
        env.storage().instance().get(&DataKey::Balance(address)).unwrap_or(0)
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    /// Set freeze status (admin only)
    pub fn set_freeze(env: Env, address: Address, frozen: bool) {
        Self::require_admin(&env);

        env.storage().instance().set(&DataKey::Frozen(address.clone()), &frozen);
        env.events().publish(("freeze", address, frozen), ());
    }

    /// Check if address is frozen
    pub fn is_frozen(env: Env, address: Address) -> bool {
        env.storage().instance().get(&DataKey::Frozen(address)).unwrap_or(false)
    }

    /// Set user role (admin only)
    pub fn set_role(env: Env, address: Address, role: UserRole) {
        Self::require_admin(&env);

        env.storage().instance().set(&DataKey::Role(address.clone()), &role);
        env.events().publish(("role_changed", address, role), ());
    }

    /// Get user role
    pub fn get_role(env: Env, address: Address) -> UserRole {
        env.storage().instance().get(&DataKey::Role(address)).unwrap_or(UserRole::User)
    }

    /// Anchor proof of reserves (admin only)
    pub fn anchor_reserves(env: Env, proof_hash: String, total_silver_grams: u64) {
        Self::require_admin(&env);

        let reserves_data = ReservesData {
            proof_hash,
            total_silver_grams,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::ReservesProof, &reserves_data);
        env.events().publish(("reserves_anchored", total_silver_grams), ());
    }

    /// Get current reserves proof
    pub fn get_reserves_proof(env: Env) -> ReservesData {
        env.storage().instance().get(&DataKey::ReservesProof).unwrap()
    }

    // Helper functions

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }


}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Env as _};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);

        DSTToken::initialize(env.clone(), admin.clone());

        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert_eq!(stored_admin, admin);
    }

    #[test]
    fn test_mint() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        DSTToken::initialize(env.clone(), admin.clone());

        // Set admin as caller
        env.mock_auths(&[admin.clone()]);

        DSTToken::mint(env.clone(), user.clone(), 100, String::from_str(&env, "proof123"));

        let balance = DSTToken::balance(env.clone(), user);
        assert_eq!(balance, 100);

        let total_supply = DSTToken::total_supply(env);
        assert_eq!(total_supply, 100);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        DSTToken::initialize(env.clone(), admin.clone());

        // Set admin as caller for minting
        env.mock_auths(&[admin.clone()]);
        DSTToken::mint(env.clone(), from.clone(), 100, String::from_str(&env, "proof123"));

        // Set from as caller for transfer
        env.mock_auths(&[from.clone()]);
        DSTToken::transfer(env.clone(), from.clone(), to.clone(), 50);

        let from_balance = DSTToken::balance(env.clone(), from);
        let to_balance = DSTToken::balance(env, to);

        assert_eq!(from_balance, 50);
        assert_eq!(to_balance, 50);
    }
}
