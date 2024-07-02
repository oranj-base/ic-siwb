use ic_cdk::update;
use ic_siwb::utils::get_script_from_address;

// Prepare the login by generating a challenge (the SIWE message) and returning it to the caller.
#[update]
fn siwb_prepare_login(address: String) -> Result<String, String> {
    // Create an EthAddress from the string. This validates the address.
    let address = get_script_from_address(address)?;

    match ic_siwb::login::prepare_login(&address.address_raw) {
        Ok(m) => Ok(m.into()),   // Converts SiweMessage to String
        Err(e) => Err(e.into()), // Converts EthError to String
    }
}
