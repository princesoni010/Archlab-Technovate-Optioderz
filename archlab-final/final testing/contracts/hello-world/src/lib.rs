#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct ArchlabAudit;

#[contractimpl]
impl ArchlabAudit {
    /// Stores the hash of a structural audit report on-chain
    pub fn store_audit_hash(env: Env, auditor: Symbol, audit_hash: Symbol) -> Vec<Symbol> {
        let mut audits = env.storage().instance().get(&auditor).unwrap_or(vec![&env]);
        audits.push_back(audit_hash);
        env.storage().instance().set(&auditor, &audits);
        audits
    }

    /// Retrieves all audit hashes for a given auditor
    pub fn get_audits(env: Env, auditor: Symbol) -> Vec<Symbol> {
        env.storage().instance().get(&auditor).unwrap_or(vec![&env])
    }
}

mod test;
