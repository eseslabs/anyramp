import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';

export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export async function connectWallet(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error('Freighter not detected — install the Freighter extension.');
  }
  const access = await requestAccess();
  if (access.error) throw new Error(String(access.error));
  return access.address;
}

export async function signXdr(xdr: string, address: string): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  if (res.error) throw new Error(String(res.error));
  return res.signedTxXdr;
}
