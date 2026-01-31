#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, Env, Symbol, Vec, String,
};

#[contracttype]
#[derive(Clone)]
pub struct Loan {
    pub id: u64,
    pub borrower: Address,
    pub collateral_amount: u64, // Amount of DST tokens locked as collateral
    pub loan_amount: u64,       // Amount of XLM loaned
    pub interest_rate: u32,     // Interest rate in basis points (e.g., 850 = 8.5%)
    pub start_time: u64,
    pub duration: u64,          // Duration in seconds
    pub status: LoanStatus,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum LoanStatus {
    Active = 0,
    Repaid = 1,
    Liquidated = 2,
    Defaulted = 3,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LoanError {
    LoanNotFound = 1,
    InsufficientCollateral = 2,
    LoanNotActive = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    LoanExpired = 6,
}

#[contract]
pub struct LoanContract;

#[contractimpl]
impl LoanContract {
    /// Initialize the loan contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&Symbol::new(&env, "admin")) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
        env.storage().instance().set(&Symbol::new(&env, "next_loan_id"), &1u64);
        env.storage().instance().set(&Symbol::new(&env, "max_ltv"), &5000u32); // 50% LTV
    }

    /// Create a new loan
    pub fn create_loan(
        env: Env,
        borrower: Address,
        collateral_amount: u64,
        loan_amount: u64,
        duration: u64,
    ) -> u64 {
        borrower.require_auth();

        let max_ltv: u32 = env.storage().instance().get(&Symbol::new(&env, "max_ltv")).unwrap();
        let required_collateral = (loan_amount * 10000) / max_ltv as u64;

        if collateral_amount < required_collateral {
            panic!("Insufficient collateral for loan amount");
        }

        let loan_id: u64 = env.storage().instance().get(&Symbol::new(&env, "next_loan_id")).unwrap();
        env.storage().instance().set(&Symbol::new(&env, "next_loan_id"), &(loan_id + 1));

        let loan = Loan {
            id: loan_id,
            borrower: borrower.clone(),
            collateral_amount,
            loan_amount,
            interest_rate: 850, // 8.5%
            start_time: env.ledger().timestamp(),
            duration,
            status: LoanStatus::Active,
        };

        env.storage().instance().set(&loan_id, &loan);

        // Update borrower's loan count
        let mut borrower_loans: Vec<u64> = env.storage().instance()
            .get(&borrower)
            .unwrap_or(Vec::new(&env));
        borrower_loans.push_back(loan_id);
        env.storage().instance().set(&borrower, &borrower_loans);

        loan_id
    }

    /// Repay a loan
    pub fn repay_loan(env: Env, loan_id: u64, repayment_amount: u64) {
        let mut loan: Loan = env.storage().instance().get(&loan_id)
            .unwrap_or_else(|| panic!("Loan not found"));

        if loan.status != LoanStatus::Active {
            panic!("Loan is not active");
        }

        // Calculate interest
        let time_elapsed = env.ledger().timestamp() - loan.start_time;
        let interest = (loan.loan_amount * loan.interest_rate as u64 * time_elapsed) /
                      (10000 * 365 * 24 * 3600); // Daily interest calculation

        let total_owed = loan.loan_amount + interest;

        if repayment_amount < total_owed {
            panic!("Insufficient repayment amount");
        }

        // Update loan status
        loan.status = LoanStatus::Repaid;
        env.storage().instance().set(&loan_id, &loan);

        // Transfer collateral back to borrower
        // Note: In a real implementation, this would transfer DST tokens back
    }

    /// Liquidate a loan (admin only)
    pub fn liquidate_loan(env: Env, loan_id: u64) {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        admin.require_auth();

        let mut loan: Loan = env.storage().instance().get(&loan_id)
            .unwrap_or_else(|| panic!("Loan not found"));

        if loan.status != LoanStatus::Active {
            panic!("Loan is not active");
        }

        // Check if loan is underwater (collateral value < loan value)
        // In a real implementation, this would check current prices

        loan.status = LoanStatus::Liquidated;
        env.storage().instance().set(&loan_id, &loan);

        // Transfer collateral to liquidator
        // Note: In a real implementation, this would transfer DST tokens
    }

    /// Get loan details
    pub fn get_loan(env: Env, loan_id: u64) -> Loan {
        env.storage().instance().get(&loan_id)
            .unwrap_or_else(|| panic!("Loan not found"))
    }

    /// Get borrower's loans
    pub fn get_borrower_loans(env: Env, borrower: Address) -> Vec<u64> {
        env.storage().instance()
            .get(&borrower)
            .unwrap_or(Vec::new(&env))
    }

    /// Update max LTV (admin only)
    pub fn set_max_ltv(env: Env, new_max_ltv: u32) {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, "admin")).unwrap();
        admin.require_auth();

        env.storage().instance().set(&Symbol::new(&env, "max_ltv"), &new_max_ltv);
    }

    /// Get max LTV
    pub fn get_max_ltv(env: Env) -> u32 {
        env.storage().instance().get(&Symbol::new(&env, "max_ltv")).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Env as _};

    #[test]
    fn test_create_loan() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LoanContract);
        let client = LoanContractClient::new(&env, &contract_id);

        let admin = Address::random(&env);
        let borrower = Address::random(&env);

        client.initialize(&admin);

        let loan_id = client.create_loan(&borrower, &1000000, &500000, &31536000); // 1 year

        assert_eq!(loan_id, 1);
    }
}
