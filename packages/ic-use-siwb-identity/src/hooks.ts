/* eslint-disable @typescript-eslint/no-explicit-any */
// import type { IWalletProvider } from '@wizz-btc/provider';
import type { SignMessageType } from '@wizz-btc/provider';
import {
  // AddressType,
  // bitcoin,
  //detectAddressTypeToScripthash, getAddressType,
  type SignOptions,
} from '@wizz-btc/wallet';
import type EventEmitter from 'events';

import { useEffect, useState } from 'react';

export type WalletProviderKey = 'wizz' | 'unisat' | 'atom' | 'okxwallet.bitcoinTestnet' | 'okxwallet.bitcoin' | 'okxwallet.bitcoinSignet';

export type NetworkType = 'testnet' | 'testnet4' | 'livenet' | 'mainnet' | 'signet' | 'bitcoin';

export interface IWalletProvider extends EventEmitter {
  fetchAndValidateFile(url: string, filePath: string, expectSHA: string): Promise<string>;

  getProxy(): string | undefined;

  // Connect the current account.
  requestAccounts(): Promise<string[]>;

  getAccounts(): Promise<string[]>;

  getNetwork(): Promise<NetworkType>;

  // Get an address type, return null if the address is invalid
  getAddressType(address: string): Promise<string | null>;

  // Get current account PublicKey
  getPublicKey(): Promise<string>;

  // Sign message
  signMessage(message: string, type?: string | SignMessageType): Promise<string>;

  // Sign Psbt(hex)
  signPsbt(psbtHex: string, options?: SignOptions): Promise<string>;

  // Sign Psbts(hexs)
  signPsbts(psbtHexs: string[], options?: SignOptions): Promise<string[]>;

  getAppVersion(): Promise<string>;

  getSupportedMethods(): Promise<string[]>;

  pushTx({ rawtx }: { rawtx: string }): Promise<string>;

  pushPsbt(psbt: string): Promise<string>;

  on(event: 'accountsChanged' | 'networkChanged', listener: (data: any) => void): this;
  removeListener(event: 'accountsChanged' | 'networkChanged', listener: (data: any) => void): this;
}

export interface NetworkItem {
  type: string;
  network: NetworkType;
}

export const NETWORKS: { [key: string]: NetworkItem } = {
  mainnet: {
    type: 'livenet',
    network: 'bitcoin',
  },
  testnet: {
    type: 'testnet',
    network: 'testnet',
  },
  testnet4: {
    type: 'testnet4',
    network: 'testnet',
  },
  signet: {
    type: 'signet',
    network: 'testnet',
  },
};

// export const useAddress = () => {
//   return useSelector((state: RootState) => state.global?.address);
// };

// export const useProviderKey = () => {
//   return useSelector((state: RootState) => state.global?.providerKey);
// };

export function getPropByKey(obj: any, key: string) {
  const keys = key.split('.');
  let result = obj;
  for (const key1 of keys) {
    if (result) {
      result = result[key1];
    }
  }
  return result;
}

export const useWalletProvider = (key: WalletProviderKey) => {
  const provider = getPropByKey(window as any, key);
  if (provider) return provider as IWalletProvider;
};

// export const useNetworkType = (): NetworkType => {
//   const network = useSelector((state: RootState) => state.global?.network);
//   return network || 'livenet';
// };

// export function useNetwork() {
//   const networkType = useNetworkType();
//   if (networkType === 'mainnet' || networkType === 'livenet' || !networkType) {
//     return NETWORKS.mainnet;
//   }
//   return NETWORKS[networkType];
// }

export function isPageHidden() {
  const doc = document as any;
  return doc.hidden || doc.msHidden || doc.webkitHidden || doc.mozHidden;
}

export function useRegisterExtension(providerKey: WalletProviderKey) {
  const provider = useWalletProvider(providerKey);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [network, setNetwork] = useState<NetworkItem>({
    type: 'livenet',
    network: 'bitcoin',
  });
  useEffect(() => {
    const wp = provider;
    const accountChange = (accounts: string[]) => {
      if (isPageHidden()) {
        return;
      }
      setAddress(accounts[0]);
    };
    const networkChange = (network: string) => {
      (async () => {
        if (isPageHidden()) {
          return;
        }
        if (network === 'mainnet' || network === 'livenet' || !network) {
          setNetwork(NETWORKS.mainnet!);
        } else {
          setNetwork(NETWORKS[network]!);
        }
      })();
    };

    const getNetwork = () => {
      wp?.getNetwork().then(networkChange);
    };

    const requestAccounts = () => {
      wp?.requestAccounts().then(accounts => {
        return accounts[0];
      });
    };
    if (wp) {
      (wp as any).on('accountsChanged', accountChange);
      (wp as any).on('networkChanged', networkChange);
      requestAccounts();
      getNetwork();
    }

    return () => {
      if (wp) {
        wp.removeListener('accountsChanged', accountChange);
        wp.removeListener('networkChanged', networkChange);
      }
    };
  }, [provider, providerKey]);
  return { provider, providerKey, address, network };
}
