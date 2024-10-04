import { IdbStorage } from '@dfinity/auth-client';
import { DelegationChain, Ed25519KeyIdentity } from '@dfinity/identity';

export const KEY_STORAGE_KEY = 'identity';
export const KEY_STORAGE_DELEGATION = 'delegation';
export const KEY_STORAGE_ADDRESS = 'address';

export class SiwbStorage extends IdbStorage {
  constructor() {
    // { dbName: 'siwb-db', storeName: 'ic-keyval' }
    super();
  }

  static async save(
    identity: Ed25519KeyIdentity,
    delegation: DelegationChain,
    address: string,
  ) {
    const storage = new this();
    await storage.set(KEY_STORAGE_KEY, JSON.stringify(identity.toJSON()));
    await storage.set(
      KEY_STORAGE_DELEGATION,
      JSON.stringify(delegation.toJSON()),
    );
    await storage.set(KEY_STORAGE_ADDRESS, address);

    return storage;
  }

  static async load() {
    const storage = new this();
    const identity = await storage.get(KEY_STORAGE_KEY);
    const delegation = await storage.get(KEY_STORAGE_DELEGATION);
    const address = await storage.get(KEY_STORAGE_ADDRESS);

    if (!identity || !delegation || !address) {
      return null;
    }

    return {
      identity: Ed25519KeyIdentity.fromJSON(JSON.parse(identity)),
      delegation: DelegationChain.fromJSON(JSON.parse(delegation)),
      address,
    };
  }
}
