/* eslint-disable @typescript-eslint/no-explicit-any */
export type SignMessageType = 'ecdsa' | 'bip322-simple';

export type WalletProviderKey = 'wizz' | 'unisat' | 'atom' | 'okxwallet.bitcoinTestnet' | 'okxwallet.bitcoin' | 'okxwallet.bitcoinSignet';

export type NetworkType = 'testnet' | 'testnet4' | 'livenet' | 'mainnet' | 'signet' | 'bitcoin';

export interface IWalletProvider {
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

  // // Sign Psbt(hex)
  // signPsbt(psbtHex: string, options?: SignOptions): Promise<string>;

  // // Sign Psbts(hexs)
  // signPsbts(psbtHexs: string[], options?: SignOptions): Promise<string[]>;

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

export const getWalletProvider = (key: WalletProviderKey) => {
  const provider = getPropByKey(window as any, key);
  console.log({ provider, key });
  if (provider) return provider as IWalletProvider;
};

export function isPageHidden() {
  const doc = document as any;
  return doc.hidden || doc.msHidden || doc.webkitHidden || doc.mozHidden;
}

export async function getRegisterExtension(providerKey?: WalletProviderKey) {
  const provider = providerKey ? getWalletProvider(providerKey) : undefined;
  let address: string | undefined = undefined;
  let network: NetworkItem | undefined = undefined;
  const wp = provider;
  const accountChange = (accounts: string[]) => {
    if (isPageHidden()) {
      return;
    }
    address = accounts[0];
  };
  const networkChange = (_n: string) => {
    (async () => {
      if (isPageHidden()) {
        return;
      }
      if (_n === 'mainnet' || _n === 'livenet' || !_n) {
        network = NETWORKS.mainnet!;
      } else {
        network = NETWORKS[_n]!;
      }
    })();
  };

  const getNetwork = async () => {
    const network = await wp?.getNetwork();
    if (network) {
      networkChange(network);
    }
  };

  const requestAccounts = async () => {
    const accounts = await wp?.requestAccounts();
    if (accounts && accounts.length > 0) {
      address = accounts[0];
    }
  };
  if (wp) {
    (wp as any).on('accountsChanged', accountChange);
    (wp as any).on('networkChanged', networkChange);
    await requestAccounts();
    await getNetwork();
    wp.removeListener('accountsChanged', accountChange);
    wp.removeListener('networkChanged', networkChange);
  }

  return { provider, providerKey, address, network };
}
