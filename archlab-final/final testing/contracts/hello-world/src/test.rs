#![cfg(test)]
use super::{ArchlabAudit, ArchlabAuditClient};
use soroban_sdk::{env, symbol_short, vec, Env};

#[test]
fn test_audit() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArchlabAudit);
    let client = ArchlabAuditClient::new(&env, &contract_id);

    let auditor = symbol_short!("ishan");
    let hash = symbol_short!("ABCD123");

    let audits = client.store_audit_hash(&auditor, &hash);
    assert_eq!(audits, vec![&env, hash]);

    let stored = client.get_audits(&auditor);
    assert_eq!(stored, vec![&env, hash]);
}
