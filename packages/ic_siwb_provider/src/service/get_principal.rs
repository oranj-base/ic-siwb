use ic_cdk::query;
use ic_siwb::utils::{get_script_from_address, AddressInfo};
use serde_bytes::ByteBuf;

use crate::service::types::AddressScriptBuf;
use crate::{ADDRESS_PRINCIPAL, SETTINGS};

/// Retrieves the principal associated with the given Ethereum address.
///
/// # Arguments
/// * `address` - The EIP-55-compliant Ethereum address.
///
/// # Returns
/// * `Ok(ByteBuf)` - The principal if found.
/// * `Err(String)` - An error message if the address cannot be converted or no principal is found.
#[query]
fn get_principal(address: String) -> Result<ByteBuf, String> {
    SETTINGS.with_borrow(|s| {
        if s.disable_btc_to_principal_mapping {
            return Err("Ethereum address to principal mapping is disabled".to_string());
        }
        Ok(())
    })?;

    // Create an EthAddress from the string. This validates the address.
    let AddressInfo { script_buf, .. } = get_script_from_address(address)?;

    ADDRESS_PRINCIPAL.with(|ap| {
        ap.borrow()
            .get(&AddressScriptBuf(script_buf.to_bytes()))
            .map_or(
                Err("No principal found for the given address".to_string()),
                |p| Ok(ByteBuf::from(p.as_ref().to_vec())),
            )
    })
}
