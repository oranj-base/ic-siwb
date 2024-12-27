import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';
import type { Principal } from '@dfinity/principal';

export type Address = string;
export type CanisterPublicKey = PublicKey;
export interface Delegation {
  pubkey: PublicKey;
  targets: [] | [Array<Principal>];
  expiration: Timestamp;
}
export type GetAddressResponse = { Ok: Address } | { Err: string };
export type GetDelegationResponse = { Ok: SignedDelegation } | { Err: string };
export type GetPrincipalResponse = { Ok: Principal } | { Err: string };
export interface LoginDetails {
  user_canister_pubkey: CanisterPublicKey;
  expiration: Timestamp;
}
export type LoginResponse = { Ok: LoginDetails } | { Err: string };
export type PrepareLoginResponse = { Ok: SiwbMessage } | { Err: string };
export type PublicKey = Uint8Array | number[];
export type PublickeyHex = string;
export type RuntimeFeature =
  | { IncludeUriInSeed: null }
  | { DisableEthToPrincipalMapping: null }
  | { DisablePrincipalToEthMapping: null };
export type SessionKey = PublicKey;
export interface SettingsInput {
  uri: string;
  runtime_features: [] | [Array<RuntimeFeature>];
  domain: string;
  statement: [] | [string];
  scheme: [] | [string];
  salt: string;
  network: [] | [string];
  session_expires_in: [] | [bigint];
  targets: [] | [Array<string>];
  sign_in_expires_in: [] | [bigint];
}
export type SignMessageType = { Bip322Simple: null } | { ECDSA: null };
export interface SignedDelegation {
  signature: Uint8Array | number[];
  delegation: Delegation;
}
export type SiwbMessage = string;
export type SiwbSignature = string;
export type String = string;
export type Timestamp = bigint;
export interface _SERVICE {
  get_address: ActorMethod<[Principal, string], GetAddressResponse>;
  get_caller_address: ActorMethod<[[] | [string]], GetAddressResponse>;
  get_principal: ActorMethod<[Address], GetPrincipalResponse>;
  siwb_get_delegation: ActorMethod<
    [Address, SessionKey, Timestamp],
    GetDelegationResponse
  >;
  siwb_login: ActorMethod<
    [SiwbSignature, Address, PublickeyHex, SessionKey, SignMessageType],
    LoginResponse
  >;
  siwb_prepare_login: ActorMethod<[Address], PrepareLoginResponse>;
}

export const idlFactory: IDL.InterfaceFactory = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    IncludeUriInSeed: IDL.Null,
    DisableEthToPrincipalMapping: IDL.Null,
    DisablePrincipalToEthMapping: IDL.Null,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const SettingsInput = IDL.Record({
    uri: IDL.Text,
    runtime_features: IDL.Opt(IDL.Vec(RuntimeFeature)),
    domain: IDL.Text,
    statement: IDL.Opt(IDL.Text),
    scheme: IDL.Opt(IDL.Text),
    salt: IDL.Text,
    network: IDL.Opt(IDL.Text),
    session_expires_in: IDL.Opt(IDL.Nat64),
    targets: IDL.Opt(IDL.Vec(IDL.Text)),
    sign_in_expires_in: IDL.Opt(IDL.Nat64),
  });
  const Principal = IDL.Vec(IDL.Nat8);
  const String = IDL.Text;
  const Address = IDL.Text;
  const GetAddressResponse = IDL.Variant({ Ok: Address, Err: IDL.Text });
  const GetPrincipalResponse = IDL.Variant({
    Ok: Principal,
    Err: IDL.Text,
  });
  const PublicKey = IDL.Vec(IDL.Nat8);
  const SessionKey = PublicKey;
  const Timestamp = IDL.Nat64;
  const Delegation = IDL.Record({
    pubkey: PublicKey,
    targets: IDL.Opt(IDL.Vec(IDL.Principal)),
    expiration: Timestamp,
  });
  const SignedDelegation = IDL.Record({
    signature: IDL.Vec(IDL.Nat8),
    delegation: Delegation,
  });
  const GetDelegationResponse = IDL.Variant({
    Ok: SignedDelegation,
    Err: IDL.Text,
  });
  const SiwbSignature = IDL.Text;
  const PublickeyHex = IDL.Text;
  const SignMessageType = IDL.Variant({
    Bip322Simple: IDL.Null,
    ECDSA: IDL.Null,
  });
  const CanisterPublicKey = PublicKey;
  const LoginDetails = IDL.Record({
    user_canister_pubkey: CanisterPublicKey,
    expiration: Timestamp,
  });
  const LoginResponse = IDL.Variant({ Ok: LoginDetails, Err: IDL.Text });
  const SiwbMessage = IDL.Text;
  const PrepareLoginResponse = IDL.Variant({
    Ok: SiwbMessage,
    Err: IDL.Text,
  });
  return IDL.Service({
    get_address: IDL.Func([Principal, String], [GetAddressResponse], ['query']),
    get_caller_address: IDL.Func(
      [IDL.Opt(String)],
      [GetAddressResponse],
      ['query'],
    ),
    get_principal: IDL.Func([Address], [GetPrincipalResponse], ['query']),
    siwb_get_delegation: IDL.Func(
      [Address, SessionKey, Timestamp],
      [GetDelegationResponse],
      ['query'],
    ),
    siwb_login: IDL.Func(
      [SiwbSignature, Address, PublickeyHex, SessionKey, SignMessageType],
      [LoginResponse],
      [],
    ),
    siwb_prepare_login: IDL.Func([Address], [PrepareLoginResponse], []),
  });
};
export const init: (args: { IDL: typeof IDL }) => IDL.Type[] = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    IncludeUriInSeed: IDL.Null,
    DisableEthToPrincipalMapping: IDL.Null,
    DisablePrincipalToEthMapping: IDL.Null,
  });
  const SettingsInput = IDL.Record({
    uri: IDL.Text,
    runtime_features: IDL.Opt(IDL.Vec(RuntimeFeature)),
    domain: IDL.Text,
    statement: IDL.Opt(IDL.Text),
    scheme: IDL.Opt(IDL.Text),
    salt: IDL.Text,
    network: IDL.Opt(IDL.Text),
    session_expires_in: IDL.Opt(IDL.Nat64),
    targets: IDL.Opt(IDL.Vec(IDL.Text)),
    sign_in_expires_in: IDL.Opt(IDL.Nat64),
  });
  return [SettingsInput];
};
