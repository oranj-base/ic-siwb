use base64::engine::general_purpose;
use base64::Engine;
use bitcoin::key::XOnlyPublicKey;
use bitcoin::secp256k1::Secp256k1;
use bitcoin::Network::{Bitcoin, Testnet};
use bitcoin::{Address, AddressType, PublicKey as BitcoinPublicKey};
use std::fmt;
use std::mem::size_of;

use byteorder::{ByteOrder, LittleEndian};
use candid::{CandidType, Principal};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use k256::sha2::digest::FixedOutput;
use k256::sha2::{Digest, Sha256};
use serde::Deserialize;
use serde_bytes::ByteBuf;
use simple_asn1::ASN1EncodeErr;

use crate::error::BtcError;
use crate::{
    delegation::{
        create_delegation, create_delegation_hash, create_user_canister_pubkey, generate_seed,
        DelegationError,
    },
    hash,
    settings::Settings,
    signature_map::SignatureMap,
    siwb::{SiwbMessage, SiwbMessageError},
    time::get_current_time,
    with_settings, SIWB_MESSAGES,
};

const MAX_SIGS_TO_PRUNE: usize = 10;
const MAGIC_BYTES: &str = "Bitcoin Signed Message:\n";

pub struct BtcSignature(String);

/// This function is the first step of the user login process. It validates the provided Ethereum address,
/// creates a SIWE message, saves it for future use, and returns it.
///
/// # Parameters
/// * `address`: A string slice (`&str`) representing the user's Ethereum address. This address is
///   validated and used to create the SIWE message.
///
/// # Returns
/// A `Result` that, on success, contains the `SiwbMessage` for the user, or an error string on failure.
///
/// # Example
/// ```ignore
/// use ic_siwe::{
///   login::prepare_login,
///   eth::EthAddress
/// };
///
/// let address = EthAddress::new("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed").unwrap();
/// let message = prepare_login(&address).unwrap();
/// ```
pub fn prepare_login(address: &Address) -> Result<SiwbMessage, BtcError> {
    let message = SiwbMessage::new(address);

    // Save the SIWE message for use in the login call
    SIWB_MESSAGES.with_borrow_mut(|siwb_messages| {
        siwb_messages.insert(address.script_pubkey().to_bytes(), message.clone());
    });

    Ok(message)
}
/// Login details are returned after a successful login. They contain the expiration time of the
/// delegation and the user canister public key.
#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct LoginDetails {
    /// The session expiration time in nanoseconds since the UNIX epoch. This is the time at which
    /// the delegation will no longer be valid.
    pub expiration: u64,

    /// The user canister public key. This key is used to derive the user principal.
    pub user_canister_pubkey: ByteBuf,
}

pub enum LoginError {
    BtcError(BtcError),
    SiwbMessageError(SiwbMessageError),
    AddressMismatch,
    DelegationError(DelegationError),
    ASN1EncodeErr(ASN1EncodeErr),
}

impl From<BtcError> for LoginError {
    fn from(err: BtcError) -> Self {
        LoginError::BtcError(err)
    }
}

impl From<SiwbMessageError> for LoginError {
    fn from(err: SiwbMessageError) -> Self {
        LoginError::SiwbMessageError(err)
    }
}

impl From<DelegationError> for LoginError {
    fn from(err: DelegationError) -> Self {
        LoginError::DelegationError(err)
    }
}

impl From<ASN1EncodeErr> for LoginError {
    fn from(err: ASN1EncodeErr) -> Self {
        LoginError::ASN1EncodeErr(err)
    }
}

impl fmt::Display for LoginError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LoginError::BtcError(e) => write!(f, "{}", e),
            LoginError::SiwbMessageError(e) => write!(f, "{}", e),
            LoginError::AddressMismatch => write!(f, "Recovered address does not match"),
            LoginError::DelegationError(e) => write!(f, "{}", e),
            LoginError::ASN1EncodeErr(e) => write!(f, "{}", e),
        }
    }
}

/// Handles the second step of the user login process. It verifies the signature against the SIWE message,
/// creates a delegation for the session, adds it to the signature map, and returns login details
///
/// # Parameters
/// * `signature`: The SIWE message signature to verify.
/// * `address`: The Ethereum address used to sign the SIWE message.
/// * `session_key`: A unique session key to be used for the delegation.
/// * `signature_map`: A mutable reference to `SignatureMap` to which the delegation hash will be added
///   after successful validation.
/// * `canister_id`: The principal of the canister performing the login.
///
/// # Returns
/// A `Result` that, on success, contains the [LoginDetails] with session expiration and user canister
/// public key, or an error string on failure.
pub fn login(
    signature: &BtcSignature,
    address: &Address,
    public_key: String,
    session_key: ByteBuf,
    signature_map: &mut SignatureMap,
    canister_id: &Principal,
) -> Result<LoginDetails, LoginError> {
    // Remove expired SIWE messages from the state before proceeding. The init settings determines
    // the time to live for SIWE messages.
    SIWB_MESSAGES.with_borrow_mut(|siwb_messages| {
        // Prune any expired SIWE messages from the state.
        siwb_messages.prune_expired();

        // Get the previously created SIWE message for current address. If it has expired or does not
        // exist, return an error.
        let address_bytes = address.script_pubkey().to_bytes();
        let message = siwb_messages.get(&address_bytes)?;
        let message_string: String = message.clone().into();

        // Verify the supplied signature against the SIWE message and recover the Ethereum address
        // used to sign the message.

        let v = _verify_message(message_string, signature.0.clone(), public_key)
            .map_err(|_| LoginError::AddressMismatch)?;

        if verify_address(address.to_string().as_str(), v).is_err() {
            return Err(LoginError::AddressMismatch);
        }

        // At this point, the signature has been verified and the SIWE message has been used. Remove
        // the SIWE message from the state.
        siwb_messages.remove(&address_bytes);

        // The delegation is valid for the duration of the session as defined in the settings.
        let expiration = with_settings!(|settings: &Settings| {
            message
                .issued_at
                .saturating_add(settings.session_expires_in)
        });

        // The seed is what uniquely identifies the delegation. It is derived from the salt, the
        // Ethereum address and the SIWE message URI.
        let seed = generate_seed(address);

        // Before adding the signature to the signature map, prune any expired signatures.
        signature_map.prune_expired(get_current_time(), MAX_SIGS_TO_PRUNE);

        // Create the delegation and add its hash to the signature map. The seed is used as the map key.
        let delegation = create_delegation(session_key, expiration)?;
        let delegation_hash = create_delegation_hash(&delegation);
        signature_map.put(hash::hash_bytes(seed), delegation_hash);

        // Create the user canister public key from the seed. From this key, the client can derive the
        // user principal.
        let user_canister_pubkey = create_user_canister_pubkey(canister_id, seed.to_vec())?;

        Ok(LoginDetails {
            expiration,
            user_canister_pubkey: ByteBuf::from(user_canister_pubkey),
        })
    })
}

struct BufferWriter {}

impl BufferWriter {
    fn varint_buf_num(n: i64) -> Vec<u8> {
        let mut buf = Vec::new();
        if n < 253 {
            buf.push(n as u8);
        } else if n < 0x10000 {
            buf.push(253);
            let mut bytes = [0u8; size_of::<u16>()];
            LittleEndian::write_u16(&mut bytes, n as u16);
            buf.extend_from_slice(&bytes);
        } else if n < 0x100000000 {
            buf.push(254);
            let mut bytes = [0u8; size_of::<u32>()];
            LittleEndian::write_u32(&mut bytes, n as u32);
            buf.extend_from_slice(&bytes);
        } else {
            buf.push(255);
            let mut bytes = [0u8; size_of::<u64>()];
            LittleEndian::write_i32(&mut bytes[0..4], (n & -1) as i32);
            LittleEndian::write_u32(&mut bytes[4..8], (n / 0x100000000) as u32);
            buf.extend_from_slice(&bytes);
        }
        buf
    }
}

pub fn _msg_hash(message: String) -> Vec<u8> {
    let prefix1 = BufferWriter::varint_buf_num(MAGIC_BYTES.len() as i64);
    let message_buffer = message.as_bytes().to_vec();
    let prefix2 = BufferWriter::varint_buf_num(message_buffer.len() as i64);
    let mut buf = Vec::new();
    buf.extend_from_slice(&prefix1);
    buf.extend_from_slice(MAGIC_BYTES.as_bytes());
    buf.extend_from_slice(&prefix2);
    buf.extend_from_slice(&message_buffer);

    let _hash = Sha256::new_with_prefix(buf);
    let hash = Sha256::new_with_prefix(_hash.finalize_fixed().to_vec());
    return hash.finalize_fixed().to_vec();
}

fn _verify_message(
    message: String,
    signature: String,
    public_key: String,
) -> Result<Vec<u8>, String> {
    let message_prehashed = _msg_hash(message);
    let signature_bytes = general_purpose::STANDARD
        .decode(signature)
        .map_err(|_| "Invalid b64 signature".to_string())?;
    let public_key_bytes = hex::decode(public_key).map_err(|_| "Invalid public key".to_string())?;
    let recovered_public_key = recover_pub_key_compact(
        signature_bytes.as_slice(),
        message_prehashed.as_slice(),
        None,
    )?;

    return if public_key_bytes.clone() != recovered_public_key.clone() {
        Err("public_key_bytes != recovered_public_key".to_string())
    } else {
        Ok(recovered_public_key.clone())
    };
}

pub fn recover_pub_key_compact(
    signature_bytes: &[u8],
    message_hash: &[u8],
    chain_id: Option<u8>,
) -> Result<Vec<u8>, String> {
    let mut v;
    let r: Vec<u8> = signature_bytes[1..33].to_vec();
    let mut s: Vec<u8> = signature_bytes[33..65].to_vec();

    if signature_bytes.len() >= 65 {
        v = signature_bytes[0];
    } else {
        v = signature_bytes[33] >> 7;
        s[0] &= 0x7f;
    };
    if v < 27 {
        v = v + 27;
    }

    let mut bytes = [0u8; 65];
    if r.len() > 32 || s.len() > 32 {
        return Err("Cannot create secp256k1 signature: malformed signature.".to_string());
    }
    let rid = calculate_sig_recovery(v.clone(), chain_id);
    bytes[0..32].clone_from_slice(&r);
    bytes[32..64].clone_from_slice(&s);
    bytes[64] = rid;

    if rid > 3 {
        return Err(format!(
            "Cannot create secp256k1 signature: invalid recovery id. {:?}",
            rid
        ));
    }

    let recovery_id = RecoveryId::try_from(bytes[64]).map_err(|_| BtcError::InvalidRecoveryId)?;

    let signature = Signature::from_slice(&bytes[..64]).map_err(|_| BtcError::InvalidSignature)?;

    let verifying_key = VerifyingKey::recover_from_prehash(&message_hash, &signature, recovery_id)
        .map_err(|_| BtcError::PublicKeyRecoveryFailure)?;

    Ok(verifying_key.to_encoded_point(true).to_bytes().to_vec())
}

pub fn msg_hash(message: String) -> Vec<u8> {
    _msg_hash(message)
}

pub fn calculate_sig_recovery(mut v: u8, chain_id: Option<u8>) -> u8 {
    if v == 0 || v == 1 {
        return v;
    }

    return if chain_id.is_none() {
        v = v - 27;
        while v > 3 {
            v = v - 4;
        }
        v
    } else {
        v = v - (chain_id.unwrap() * 2 + 35);
        while v > 3 {
            v = v - 4;
        }
        v
    };
}

pub fn verify_address(address: &str, pub_bytes: Vec<u8>) -> Result<String, String> {
    let public_key =
        BitcoinPublicKey::from_slice(pub_bytes.as_slice()).map_err(|e| e.to_string())?;
    let secp = Secp256k1::verification_only();
    let mut network = Bitcoin;
    let mut address_type = AddressType::P2tr;

    if address.starts_with("bc1q") {
        address_type = AddressType::P2wpkh;
        network = Bitcoin;
    } else if address.starts_with("bc1p") {
        address_type = AddressType::P2tr;
        network = Bitcoin;
    } else if address.starts_with('1') {
        address_type = AddressType::P2pkh;
        network = Bitcoin;
    } else if address.starts_with('3') {
        address_type = AddressType::P2sh;
        network = Bitcoin;
    } else if address.starts_with("tb1q") {
        address_type = AddressType::P2wpkh;
        network = Testnet;
    } else if address.starts_with('m') || address.starts_with('n') {
        address_type = AddressType::P2pkh;
        network = Testnet;
    } else if address.starts_with('2') {
        address_type = AddressType::P2sh;
        network = Testnet;
    } else if address.starts_with("tb1p") {
        address_type = AddressType::P2tr;
        network = Testnet;
    }
    let compressed = if !public_key.compressed {
        BitcoinPublicKey::from_slice(&public_key.inner.serialize())
            .map_err(|e| e.to_string())
            .clone()?
    } else {
        public_key
    };

    match address_type {
        AddressType::P2pkh => {
            let p2pkh_address = Address::p2pkh(&public_key, network);
            Ok(p2pkh_address.to_string())
        }
        AddressType::P2wpkh => {
            let p2wpkh_address =
                Address::p2wpkh(&compressed, network).map_err(|e| e.to_string())?;
            Ok(p2wpkh_address.to_string())
        }
        AddressType::P2sh => {
            let p2sh_address =
                Address::p2shwpkh(&compressed, network).map_err(|e| e.to_string())?;
            Ok(p2sh_address.to_string())
        }
        AddressType::P2tr => {
            let internal_key = XOnlyPublicKey::from_slice(pub_bytes[1..].to_vec().as_slice())
                .map_err(|e| e.to_string())?;
            Ok(Address::p2tr(&secp, internal_key, None, network).to_string())
        }
        _ => Err("Unknown Address".to_string()),
    }
}

#[cfg(test)]
mod test {
    use crate::login::{_verify_message, verify_address};

    #[test]
    fn test_get_address() {
        let p2tr_t = verify_address(
            "tb1pgvdp7lf89d62zadds5jvyjntxmr7v70yv33g7vqaeu2p0cuexveqjlwphr",
            hex::decode("03133c85d348d6c0796382966380719397453592e706cd3329119a2d2cb8d2ff7b")
                .unwrap(),
        );
        let p2tr = verify_address(
            "bc1pgvdp7lf89d62zadds5jvyjntxmr7v70yv33g7vqaeu2p0cuexveq9hcwdv",
            hex::decode("03133c85d348d6c0796382966380719397453592e706cd3329119a2d2cb8d2ff7b")
                .unwrap(),
        );
        assert_eq!(
            p2tr_t.unwrap(),
            "tb1pgvdp7lf89d62zadds5jvyjntxmr7v70yv33g7vqaeu2p0cuexveqjlwphr".to_string()
        );
        assert_eq!(
            p2tr.unwrap(),
            "bc1pgvdp7lf89d62zadds5jvyjntxmr7v70yv33g7vqaeu2p0cuexveq9hcwdv".to_string()
        );

        let p2shp2wpkh_t = verify_address(
            "2NBbnaYUvZvrvKfd7wqMmt7bZoAMTSkAarU",
            hex::decode("02e203c98d766554bb4dab431d70b014b505aac66f47b735d9e7cbb4f12108ac3d")
                .unwrap(),
        );
        let p2shp2wpkh = verify_address(
            "3L3aWoYtxUMa7szaGhjuGAcJap9Hb13EEP",
            hex::decode("02e203c98d766554bb4dab431d70b014b505aac66f47b735d9e7cbb4f12108ac3d")
                .unwrap(),
        );
        assert_eq!(
            p2shp2wpkh_t.unwrap(),
            "2NBbnaYUvZvrvKfd7wqMmt7bZoAMTSkAarU".to_string()
        );
        assert_eq!(
            p2shp2wpkh.unwrap(),
            "3L3aWoYtxUMa7szaGhjuGAcJap9Hb13EEP".to_string()
        );

        let p2wpkh_t = verify_address(
            "tb1qshqyem2rf8jyla904gd2cvek2k8nz5z3vc2j3x",
            hex::decode("03f72a781776c63888aa9af5478c72c4794165a44024679995f6d232b4f6254574")
                .unwrap(),
        );
        let p2wpkh = verify_address(
            "bc1qshqyem2rf8jyla904gd2cvek2k8nz5z3x73p24",
            hex::decode("03f72a781776c63888aa9af5478c72c4794165a44024679995f6d232b4f6254574")
                .unwrap(),
        );
        assert_eq!(
            p2wpkh_t.unwrap(),
            "tb1qshqyem2rf8jyla904gd2cvek2k8nz5z3vc2j3x".to_string()
        );
        assert_eq!(
            p2wpkh.unwrap(),
            "bc1qshqyem2rf8jyla904gd2cvek2k8nz5z3x73p24".to_string()
        );

        let p2pkh_t = verify_address(
            "mt1ycNxRhKVf1JyHhrKQEuuMoBnSPrwxfM",
            hex::decode("03133c85d348d6c0796382966380719397453592e706cd3329119a2d2cb8d2ff7b")
                .unwrap(),
        );
        let p2pkh = verify_address(
            "1DW2KKsStJ4QECVfzHM2Qzh2wCBjTe9TH1",
            hex::decode("03133c85d348d6c0796382966380719397453592e706cd3329119a2d2cb8d2ff7b")
                .unwrap(),
        );
        assert_eq!(
            p2pkh_t.unwrap(),
            "mt1ycNxRhKVf1JyHhrKQEuuMoBnSPrwxfM".to_string()
        );
        assert_eq!(
            p2pkh.unwrap(),
            "1DW2KKsStJ4QECVfzHM2Qzh2wCBjTe9TH1".to_string()
        );
    }
    #[test]
    fn test_message() {
        let p = "03133c85d348d6c0796382966380719397453592e706cd3329119a2d2cb8d2ff7b".to_string();
        let s =  "HPVVoaHfyCUER9YB6MC8C+eh3in24rHTScQopgwzzEx6GP9fwZBI+ZIesS1HNzbMzMgLFS10IyhMc6aYbn3zfI4=".to_string();
        let m = "{\"a\":1,\"b\":[2,3,4]}".to_string();
        let a = "tb1pgvdp7lf89d62zadds5jvyjntxmr7v70yv33g7vqaeu2p0cuexveqjlwphr".to_string();

        let v = _verify_message(m, s, p);
        println!("v is {:?}", v);

        let v2 = verify_address(a.as_str(), v.unwrap());
        println!("v2 is {:?}", v2);
    }
}
