import type { DelegationChain, DelegationIdentity } from '@dfinity/identity';

import type { ActorSubclass } from '@dfinity/agent';
import type { SIWB_IDENTITY_SERVICE } from './service.interface';
import type { IWalletProvider, NetworkItem, WalletProviderKey } from './hooks';

export type PrepareLoginStatus = 'error' | 'preparing' | 'success' | 'idle';
export type LoginStatus = 'error' | 'logging-in' | 'success' | 'idle';

export type State = {
  selectedProvider?: WalletProviderKey;
  connectedBtcAddress?: string;
  provider?: IWalletProvider;
  network?: NetworkItem;
  anonymousActor?: ActorSubclass<SIWB_IDENTITY_SERVICE>;
  isInitializing: boolean;
  prepareLoginStatus: PrepareLoginStatus;
  prepareLoginError?: Error;
  siwbMessage?: string;
  loginStatus: LoginStatus;
  loginError?: Error;
  identity?: DelegationIdentity;
  identityAddress?: string;
  delegationChain?: DelegationChain;
};
