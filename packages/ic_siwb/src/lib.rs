pub mod delegation;
pub mod hash;
pub mod macros;
pub mod signature_map;
pub mod time;
pub mod settings;
pub mod rand;
pub mod init;
pub mod siwb;
pub mod login;
pub mod error;

pub use init::init;

use std::cell::RefCell;

#[cfg(feature = "nonce")]
use rand_chacha::ChaCha20Rng;
use crate::settings::Settings;
use crate::siwb::SiwbMessageMap;

thread_local! {
    // The random number generator is used to generate nonces for SIWE messages. This feature is
    // optional and can be enabled by setting the `nonce` feature flag.
    #[cfg(feature = "nonce")]
    static RNG: RefCell<Option<ChaCha20Rng>> = RefCell::new(None);

    // The settings control the behavior of the SIWE library. The settings must be initialized
    // before any other library functions are called.
    static SETTINGS: RefCell<Option<Settings>> = RefCell::new(None);

    // SIWE messages are stored in global state during the login process. The key is the
    // Ethereum address as a byte array and the value is the SIWE message. After a successful
    // login, the SIWE message is removed from state.
    static SIWB_MESSAGES: RefCell<SiwbMessageMap> = RefCell::new(SiwbMessageMap::new());
}
