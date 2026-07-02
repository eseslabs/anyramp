# AnyRamp Frontend

Vite + React + TypeScript demo UI with **Freighter** wallet, for the buyer to submit
the zkTLS proof and claim USDC — fully trustless (buyer signs on-chain themselves).

## Run

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:4000
bun install
bun run dev               # http://localhost:5173
```

Requires the [Freighter](https://www.freighter.app/) browser extension (set to Testnet)
and the backend running on `:4000`.

## Flow (matches the on-chain P2P escrow)

1. **Connect Freighter** — buyer wallet address.
2. **New demo order** (or Load an existing `orderId`) — issues a Pakasir QRIS.
3. **Seller · Lock USDC** — locks USDC into the escrow on-chain.
4. **Seller · Simulate payment** — sandbox payment → webhook.
5. **Buyer · Generate ZK proof** — Reclaim zkTLS proof over Pakasir `transactiondetail`.
6. **Buyer · Claim USDC** — backend builds the `fulfill_with_proof` tx, buyer **signs in
   Freighter**, backend relays it; the escrow verifies the proof on-chain and releases USDC.

Steps 3–5 are demo conveniences; in production the seller and payment happen out-of-band,
and only step 6 (buyer claim) is the trustless on-chain settlement.
