import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { STELLAR_NETWORK } from "@/lib/stellar-address";

let initialized = false;

function ensureKit() {
  if (typeof window === "undefined") {
    throw new Error("Wallet connection is only available in the browser.");
  }

  if (!initialized) {
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC,
    });
    initialized = true;
  }
}

export async function connectExternalStellarWallet() {
  ensureKit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

export async function disconnectExternalStellarWallet() {
  if (!initialized) return;
  await StellarWalletsKit.disconnect();
}
