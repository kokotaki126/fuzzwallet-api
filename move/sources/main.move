module multisig::address{
    use aptos_framework::account;
    use std::vector;
    use std::bcs::to_bytes;

    const DOMAIN_SEPARATOR: vector<u8> = b"aptos_framework::multisig_account";

    fun create_multisig_account_seed(seed: vector<u8>): vector<u8> {
        // Generate a seed that will be used to create the resource account that hosts the multisig account.
        let multisig_account_seed = vector::empty<u8>();
        vector::append(&mut multisig_account_seed, DOMAIN_SEPARATOR);
        vector::append(&mut multisig_account_seed, seed);

        multisig_account_seed
    }

    #[view]
    public fun get_next_multisig_address(addr: address, seed: u64): address {
        account::create_resource_address(&addr, create_multisig_account_seed(to_bytes(&seed)))
    }
}