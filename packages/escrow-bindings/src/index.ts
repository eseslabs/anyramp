import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"OrderExists"},
  4: {message:"OrderNotFound"},
  5: {message:"OrderNotOpen"},
  6: {message:"BadProof"},
  7: {message:"NotCompleted"},
  8: {message:"AmountTooLow"},
  9: {message:"OrderMismatch"},
  10: {message:"ProjectMismatch"},
  11: {message:"WrongProvider"},
  12: {message:"NotExpired"},
  13: {message:"SandboxNotAllowed"}
}


export interface Order {
  expected_idr: u64;
  expiry: u64;
  order_id: Buffer;
  project: Buffer;
  seller: string;
  status: OrderStatus;
  usdc_amount: i128;
}


export interface Config {
  admin: string;
  allow_sandbox: boolean;
  usdc: string;
  verifier: string;
}

export type OrderStatus = {tag: "Open", values: void} | {tag: "Fulfilled", values: void} | {tag: "Refunded", values: void};

export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Seller reclaims locked USDC after expiry if the order was never fulfilled.
   */
  refund: ({order_id}: {order_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_order transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_order: ({order_id}: {order_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Order>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time setup. `verifier` = deployed Reclaim verifier contract.
   */
  initialize: ({admin, usdc, verifier, allow_sandbox}: {admin: string, usdc: string, verifier: string, allow_sandbox: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_order transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Seller opens an intent and locks `usdc_amount` USDC into escrow.
   * The order is keyed by the Pakasir `order_id` the buyer will pay against.
   */
  create_order: ({seller, order_id, project, usdc_amount, expected_idr, expiry}: {seller: string, order_id: Buffer, project: Buffer, usdc_amount: i128, expected_idr: u64, expiry: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a fulfill_with_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buyer submits the Reclaim zkTLS proof of their Pakasir payment and, if valid,
   * receives the locked USDC. Buyer authorizes (and pays gas) — fully trustless.
   */
  fulfill_with_proof: ({buyer, order_id, provider, parameters, context, owner, timestamp, epoch, signature, recovery_id}: {buyer: string, order_id: Buffer, provider: Buffer, parameters: Buffer, context: Buffer, owner: Buffer, timestamp: u64, epoch: u64, signature: Buffer, recovery_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALT3JkZXJFeGlzdHMAAAAAAwAAAAAAAAANT3JkZXJOb3RGb3VuZAAAAAAAAAQAAAAAAAAADE9yZGVyTm90T3BlbgAAAAUAAAAAAAAACEJhZFByb29mAAAABgAAAAAAAAAMTm90Q29tcGxldGVkAAAABwAAAAAAAAAMQW1vdW50VG9vTG93AAAACAAAAAAAAAANT3JkZXJNaXNtYXRjaAAAAAAAAAkAAAAAAAAAD1Byb2plY3RNaXNtYXRjaAAAAAAKAAAAAAAAAA1Xcm9uZ1Byb3ZpZGVyAAAAAAAACwAAAAAAAAAKTm90RXhwaXJlZAAAAAAADAAAAAAAAAARU2FuZGJveE5vdEFsbG93ZWQAAAAAAAAN",
        "AAAAAQAAAAAAAAAAAAAABU9yZGVyAAAAAAAABwAAAAAAAAAMZXhwZWN0ZWRfaWRyAAAABgAAAAAAAAAGZXhwaXJ5AAAAAAAGAAAAAAAAAAhvcmRlcl9pZAAAAA4AAAAAAAAAB3Byb2plY3QAAAAADgAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAALT3JkZXJTdGF0dXMAAAAAAAAAAAt1c2RjX2Ftb3VudAAAAAAL",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1hbGxvd19zYW5kYm94AAAAAAAAAQAAAAAAAAAEdXNkYwAAABMAAAAAAAAACHZlcmlmaWVyAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAAC09yZGVyU3RhdHVzAAAAAAMAAAAAAAAAAAAAAARPcGVuAAAAAAAAAAAAAAAJRnVsZmlsbGVkAAAAAAAAAAAAAAAAAAAIUmVmdW5kZWQ=",
        "AAAAAAAAAEpTZWxsZXIgcmVjbGFpbXMgbG9ja2VkIFVTREMgYWZ0ZXIgZXhwaXJ5IGlmIHRoZSBvcmRlciB3YXMgbmV2ZXIgZnVsZmlsbGVkLgAAAAAABnJlZnVuZAAAAAAAAQAAAAAAAAAIb3JkZXJfaWQAAAAOAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAJZ2V0X29yZGVyAAAAAAAAAQAAAAAAAAAIb3JkZXJfaWQAAAAOAAAAAQAAA+gAAAfQAAAABU9yZGVyAAAA",
        "AAAAAAAAAEBPbmUtdGltZSBzZXR1cC4gYHZlcmlmaWVyYCA9IGRlcGxveWVkIFJlY2xhaW0gdmVyaWZpZXIgY29udHJhY3QuAAAACmluaXRpYWxpemUAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAEdXNkYwAAABMAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAANYWxsb3dfc2FuZGJveAAAAAAAAAEAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAIlTZWxsZXIgb3BlbnMgYW4gaW50ZW50IGFuZCBsb2NrcyBgdXNkY19hbW91bnRgIFVTREMgaW50byBlc2Nyb3cuClRoZSBvcmRlciBpcyBrZXllZCBieSB0aGUgUGFrYXNpciBgb3JkZXJfaWRgIHRoZSBidXllciB3aWxsIHBheSBhZ2FpbnN0LgAAAAAAAAxjcmVhdGVfb3JkZXIAAAAGAAAAAAAAAAZzZWxsZXIAAAAAABMAAAAAAAAACG9yZGVyX2lkAAAADgAAAAAAAAAHcHJvamVjdAAAAAAOAAAAAAAAAAt1c2RjX2Ftb3VudAAAAAALAAAAAAAAAAxleHBlY3RlZF9pZHIAAAAGAAAAAAAAAAZleHBpcnkAAAAAAAYAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAJxCdXllciBzdWJtaXRzIHRoZSBSZWNsYWltIHprVExTIHByb29mIG9mIHRoZWlyIFBha2FzaXIgcGF5bWVudCBhbmQsIGlmIHZhbGlkLApyZWNlaXZlcyB0aGUgbG9ja2VkIFVTREMuIEJ1eWVyIGF1dGhvcml6ZXMgKGFuZCBwYXlzIGdhcykg4oCUIGZ1bGx5IHRydXN0bGVzcy4AAAASZnVsZmlsbF93aXRoX3Byb29mAAAAAAAKAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAACG9yZGVyX2lkAAAADgAAAAAAAAAIcHJvdmlkZXIAAAAOAAAAAAAAAApwYXJhbWV0ZXJzAAAAAAAOAAAAAAAAAAdjb250ZXh0AAAAAA4AAAAAAAAABW93bmVyAAAAAAAADgAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAFZXBvY2gAAAAAAAAGAAAAAAAAAAlzaWduYXR1cmUAAAAAAAPuAAAAQAAAAAAAAAALcmVjb3ZlcnlfaWQAAAAABAAAAAEAAAPpAAAAAgAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<Result<void>>,
        get_order: this.txFromJSON<Option<Order>>,
        initialize: this.txFromJSON<Result<void>>,
        create_order: this.txFromJSON<Result<void>>,
        fulfill_with_proof: this.txFromJSON<Result<void>>
  }
}