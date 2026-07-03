// Thin backend layer over @anyramp/sdk. All contract-arg building lives in the SDK
// (generated bindings + proof mapping) — this file only wires env + submits.
// Contract layout/address changes: regenerate @anyramp/escrow-bindings, done.
import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  makeEscrowClient,
  publicKeyOf,
  proofToFulfillArgs,
  type ReclaimProofLike,
} from '@anyramp/sdk';
import { env } from '../config/env.ts';
import type { Order } from '../db/schema.ts';

const submitterPk = () => publicKeyOf(env.SUBMITTER_SECRET);

function escrow(contractId: string) {
  return makeEscrowClient({
    contractId,
    rpcUrl: env.SOROBAN_RPC_URL,
    networkPassphrase: env.NETWORK_PASSPHRASE,
    secretKey: env.SUBMITTER_SECRET,
  });
}

// --- Deploy is an ops action, kept on the stellar CLI (installs wasm + inits). ---
export async function deployAndInitEscrow(): Promise<string> {
  const net = [
    '--rpc-url', env.SOROBAN_RPC_URL,
    '--network-passphrase', env.NETWORK_PASSPHRASE,
    '--source', env.DEPLOYER_KEY,
  ];
  const run = async (args: string[]) => {
    const p = Bun.spawn([env.STELLAR_BIN, ...args], { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' });
    await p.exited;
    const out = (await new Response(p.stdout).text()).trim();
    if (p.exitCode !== 0) throw new Error(`stellar ${args[1]}: ${(await new Response(p.stderr).text()).trim() || out}`);
    return out;
  };
  const out = await run(['contract', 'deploy', '--wasm', '../target/wasm32v1-none/release/escrow.wasm', ...net]);
  const id = out.split('\n').pop()?.trim() ?? '';
  if (!/^C[A-Z0-9]{55}$/.test(id)) throw new Error(`deploy failed: ${out}`);
  await run([
    'contract', 'invoke', '--id', id, ...net, '--send=yes', '--',
    'initialize', '--admin', submitterPk(), '--usdc', env.USDC_CONTRACT_ID,
    '--verifier', env.RECLAIM_VERIFIER_ID, '--allow_sandbox', 'true',
  ]);
  return id;
}

// --- Seller locks USDC (typed, via SDK). ---
export async function lockOn(
  contractId: string,
  o: { orderId: string; usdcAmount: string; amountIdr: number },
  project: string,
) {
  const tx = await escrow(contractId).create_order({
    seller: submitterPk(),
    order_id: Buffer.from(o.orderId, 'utf8'),
    project: Buffer.from(project, 'utf8'),
    usdc_amount: BigInt(o.usdcAmount),
    expected_idr: BigInt(o.amountIdr),
    expiry: 9_999_999_999n,
  });
  const sent = await tx.signAndSend();
  return sent.sendTransactionResponse?.hash ?? '';
}

export async function createOrderOnChain(order: Order, project: string) {
  const hash = await lockOn(
    env.ESCROW_CONTRACT_ID,
    { orderId: order.orderId, usdcAmount: order.usdcAmount, amountIdr: order.amountIdr },
    project,
  );
  return { hash, seller: submitterPk() };
}

// --- Fulfill with a proof (typed, via SDK). ---
export async function fulfillOn(
  contractId: string,
  order: { orderId: string },
  proof: ReclaimProofLike,
) {
  const tx = await escrow(contractId).fulfill_with_proof({
    buyer: submitterPk(),
    ...proofToFulfillArgs(order.orderId, proof),
  });
  const sent = await tx.signAndSend();
  return sent.sendTransactionResponse?.hash ?? '';
}

export async function autoSubmitFulfill(order: Order, proof: ReclaimProofLike) {
  const hash = await fulfillOn(env.ESCROW_CONTRACT_ID, order, proof);
  return { hash, buyer: submitterPk() };
}

/** Trustless path: build the unsigned fulfill tx XDR for the buyer to sign in their wallet. */
export async function buildFulfillXdr(buyer: string, order: Order, proof: ReclaimProofLike) {
  const client = makeEscrowClient({
    contractId: env.ESCROW_CONTRACT_ID,
    rpcUrl: env.SOROBAN_RPC_URL,
    networkPassphrase: env.NETWORK_PASSPHRASE,
    secretKey: env.SUBMITTER_SECRET, // only used to shape the client; buyer signs client-side
  });
  const tx = await client.fulfill_with_proof(
    { buyer, ...proofToFulfillArgs(order.orderId, proof) },
    { simulate: true },
  );
  return tx.toXDR();
}

/** Submit a wallet-signed tx XDR. */
export async function submitSignedXdr(signedXdr: string) {
  const s = new rpc.Server(env.SOROBAN_RPC_URL);
  const tx = TransactionBuilder.fromXDR(signedXdr, env.NETWORK_PASSPHRASE);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  return sent.hash;
}
