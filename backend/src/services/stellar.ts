// Stellar/Soroban submission for AnyRampEscrow.
// - buildFulfillXdr: returns an unsigned, prepared tx for the buyer to sign in Freighter (trustless path).
// - autoSubmitFulfill: signs with SUBMITTER_SECRET and submits (demo path, buyer == submitter).
// - createOrderOnChain: seller locks USDC (demo helper).
import {
  rpc,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  xdr,
  Keypair,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { env } from '../config/env.ts';
import { proofToContractArgs, type ReclaimProofLike } from './zkprover.ts';
import type { Order } from '../db/schema.ts';

const server = () => new rpc.Server(env.SOROBAN_RPC_URL);

const contract = () => new Contract(env.ESCROW_CONTRACT_ID);
const contractFor = (id: string) => new Contract(id);

const netArgs = () => [
  '--rpc-url', env.SOROBAN_RPC_URL,
  '--network-passphrase', env.NETWORK_PASSPHRASE,
  '--source', env.DEPLOYER_KEY,
];

/** Run the stellar CLI async (non-blocking — never freezes the Bun event loop). */
async function runStellar(args: string[]): Promise<string> {
  const proc = Bun.spawn([env.STELLAR_BIN, ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
  const out = (await new Response(proc.stdout).text()).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`stellar ${args[0]} ${args[1]}: ${(await new Response(proc.stderr).text()).trim() || out}`);
  }
  return out;
}

/** Deploy + initialize a fresh escrow (allow_sandbox=true). Returns its contract id. */
export async function deployAndInitEscrow(): Promise<string> {
  const out = await runStellar([
    'contract', 'deploy', '--wasm', '../target/wasm32v1-none/release/escrow.wasm', ...netArgs(),
  ]);
  const id = out.split('\n').pop()?.trim() ?? '';
  if (!/^C[A-Z0-9]{55}$/.test(id)) throw new Error(`deploy failed: ${out}`);
  const admin = Keypair.fromSecret(env.SUBMITTER_SECRET).publicKey();
  await runStellar([
    'contract', 'invoke', '--id', id, ...netArgs(), '--send=yes', '--',
    'initialize', '--admin', admin, '--usdc', env.USDC_CONTRACT_ID,
    '--verifier', env.RECLAIM_VERIFIER_ID, '--allow_sandbox', 'true',
  ]);
  return id;
}

/** Sign + submit and return the hash immediately, without waiting for confirmation. */
async function sendNoWait(prepared: Awaited<ReturnType<typeof buildPrepared>>, secret: string) {
  const s = server();
  prepared.sign(Keypair.fromSecret(secret));
  const sent = await s.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  return sent.hash;
}

/** Seller locks USDC for the demo order on a specific escrow. */
export async function lockOn(
  escrowId: string,
  o: { orderId: string; usdcAmount: string; amountIdr: number },
  project: string,
) {
  const seller = Keypair.fromSecret(env.SUBMITTER_SECRET).publicKey();
  const op = contractFor(escrowId).call(
    'create_order',
    scAddr(seller), scText(o.orderId), scText(project),
    scI128(o.usdcAmount), scU64(o.amountIdr), scU64(9_999_999_999),
  );
  const prepared = await buildPrepared(seller, op);
  return signAndSend(prepared, env.SUBMITTER_SECRET);
}

/** Fulfill the demo order on a specific escrow. `wait=false` returns right after submit. */
export async function fulfillOn(
  escrowId: string,
  order: { orderId: string },
  proof: ReclaimProofLike,
  wait = false,
) {
  const buyer = Keypair.fromSecret(env.SUBMITTER_SECRET).publicKey();
  const op = contractFor(escrowId).call('fulfill_with_proof', ...fulfillArgs(buyer, order as Order, proof));
  const prepared = await buildPrepared(buyer, op);
  return wait ? signAndSend(prepared, env.SUBMITTER_SECRET) : sendNoWait(prepared, env.SUBMITTER_SECRET);
}

const scBytes = (b: Buffer | Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const scText = (s: string) => scBytes(Buffer.from(s, 'utf8'));
const scAddr = (a: string) => new Address(a).toScVal();
const scU64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });
const scU32 = (n: number) => nativeToScVal(n, { type: 'u32' });
const scI128 = (n: string | bigint) => nativeToScVal(BigInt(n), { type: 'i128' });

function fulfillArgs(buyer: string, order: Order, proof: ReclaimProofLike): xdr.ScVal[] {
  const a = proofToContractArgs(proof);
  return [
    scAddr(buyer),
    scText(order.orderId),
    scBytes(a.provider),
    scBytes(a.parameters),
    scBytes(a.context),
    scBytes(a.owner),
    scU64(a.timestamp),
    scU64(a.epoch),
    scBytes(a.signature),
    scU32(a.recovery_id),
  ];
}

async function buildPrepared(sourcePublicKey: string, op: xdr.Operation) {
  const s = server();
  const account = await s.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();
  return s.prepareTransaction(tx);
}

async function signAndSend(prepared: Awaited<ReturnType<typeof buildPrepared>>, secret: string) {
  const s = server();
  prepared.sign(Keypair.fromSecret(secret));
  const sent = await s.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  // poll for completion
  let get = await s.getTransaction(sent.hash);
  for (let i = 0; i < 30 && get.status === 'NOT_FOUND'; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    get = await s.getTransaction(sent.hash);
  }
  if (get.status !== 'SUCCESS') {
    throw new Error(`tx ${sent.hash} -> ${get.status}`);
  }
  return sent.hash;
}

/** Trustless path: build the unsigned prepared tx for the buyer to sign in Freighter. */
export async function buildFulfillXdr(buyer: string, order: Order, proof: ReclaimProofLike) {
  const op = contract().call('fulfill_with_proof', ...fulfillArgs(buyer, order, proof));
  const prepared = await buildPrepared(buyer, op);
  return prepared.toXDR();
}

/** Demo path: submit with the server key acting as the buyer. */
export async function autoSubmitFulfill(order: Order, proof: ReclaimProofLike) {
  if (!env.SUBMITTER_SECRET) throw new Error('SUBMITTER_SECRET not set');
  const buyer = Keypair.fromSecret(env.SUBMITTER_SECRET).publicKey();
  const op = contract().call('fulfill_with_proof', ...fulfillArgs(buyer, order, proof));
  const prepared = await buildPrepared(buyer, op);
  const hash = await signAndSend(prepared, env.SUBMITTER_SECRET);
  return { hash, buyer };
}

/** Demo helper: seller (== submitter) locks USDC on-chain for this order. */
export async function createOrderOnChain(order: Order, project: string) {
  if (!env.SUBMITTER_SECRET) throw new Error('SUBMITTER_SECRET not set');
  const seller = Keypair.fromSecret(env.SUBMITTER_SECRET).publicKey();
  const op = contract().call(
    'create_order',
    scAddr(seller),
    scText(order.orderId),
    scText(project),
    scI128(order.usdcAmount),
    scU64(order.amountIdr),
    scU64(9_999_999_999),
  );
  const prepared = await buildPrepared(seller, op);
  const hash = await signAndSend(prepared, env.SUBMITTER_SECRET);
  return { hash, seller };
}

/** Submit a Freighter-signed tx XDR (from buildFulfillXdr). */
export async function submitSignedXdr(signedXdr: string) {
  const s = server();
  const tx = TransactionBuilder.fromXDR(signedXdr, env.NETWORK_PASSPHRASE);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  return sent.hash;
}
