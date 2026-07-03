import { CURRENCY_RATES, formatFiat, type CurrencyCode } from "@/lib/currencies";
import {
  DEFAULT_ONRAMP_GATEWAYS,
  type PaymentGatewayId,
} from "@/lib/payment-gateways";
import { api, type BackendPool } from "@/lib/api";

export type PoolType = "onramp" | "topup";
export type LiquidityAsset = "USDC" | "XLM";

export type LiquidityPosition = {
  id: string;
  pool: PoolType;
  asset: LiquidityAsset;
  deposited: number;
  rateMarkupBps: number;
  maxOrderFiat: number;
  paymentGateways: PaymentGatewayId[];
  apy: number;
  earnedFiat: number;
  createdAt: string;
};

export const WALLET_BALANCES: Record<LiquidityAsset, number> = {
  USDC: 8420,
  XLM: 28500,
};

export const ONRAMP_APY = 8.2;
export const TOPUP_APY = 6.4;
export const XLM_USD = 0.112;

export const RATE_MARKUP_OPTIONS = [
  { label: "Market", bps: 0 },
  { label: "+0.25%", bps: 25 },
  { label: "+0.5%", bps: 50 },
  { label: "+1%", bps: 100 },
] as const;

export const VOLUME_CAP_OPTIONS = [500_000, 1_000_000, 2_500_000, 5_000_000] as const;

const FIAT: CurrencyCode = "IDR";

function toLiquidityPosition(p: BackendPool): LiquidityPosition {
  return {
    id: p.id,
    pool: p.pool,
    asset: p.asset,
    deposited: p.deposited,
    rateMarkupBps: p.rateMarkupBps,
    maxOrderFiat: p.maxOrderFiat,
    paymentGateways: (p.paymentGateways as PaymentGatewayId[]) ??
      (p.pool === "onramp" ? DEFAULT_ONRAMP_GATEWAYS : []),
    apy: p.apy,
    earnedFiat: p.earnedFiat,
    createdAt: p.createdAt,
  };
}

export async function getLiquidityPositions(): Promise<LiquidityPosition[]> {
  const pools = await api.listPools();
  return pools.map(toLiquidityPosition);
}

export async function getMyLiquidityPositions(sellerAddress: string): Promise<LiquidityPosition[]> {
  const pools = await api.listMyPools(sellerAddress);
  return pools.map(toLiquidityPosition);
}

export async function addLiquidityPosition(
  input: Omit<LiquidityPosition, "id" | "createdAt" | "earnedFiat"> & {
    sellerAddress: string;
  },
): Promise<LiquidityPosition> {
  const pool = await api.createPool({
    sellerAddress: input.sellerAddress,
    pool: input.pool,
    asset: input.asset,
    deposited: input.deposited,
    rateMarkupBps: input.rateMarkupBps,
    maxOrderFiat: input.maxOrderFiat,
    paymentGateways: input.paymentGateways,
    apy: input.apy,
  });
  return toLiquidityPosition(pool);
}

export function generatePositionId(asset: LiquidityAsset): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LP-${Date.now().toString(36).slice(-4).toUpperCase()}-${asset}-${suffix}`;
}

export function poolLabel(pool: PoolType) {
  return pool === "onramp" ? "Onramp · USDC" : "Topup · XLM";
}

export function formatDeposited(amount: number, asset: LiquidityAsset) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${asset}`;
}

export function formatEarned(fiat: number) {
  return `+${formatFiat(fiat, FIAT)}`;
}

export function supportedFiatVolume(
  amount: number,
  asset: LiquidityAsset,
  markupBps: number,
) {
  const base =
    asset === "USDC"
      ? amount * CURRENCY_RATES.IDR
      : amount * XLM_USD * CURRENCY_RATES.IDR;
  return base * (1 + markupBps / 10_000);
}

export function effectiveRateLabel(asset: LiquidityAsset, markupBps: number) {
  const idr = CURRENCY_RATES.IDR;
  if (asset === "USDC") {
    const rate = idr * (1 + markupBps / 10_000);
    return `1 USDC = ${formatFiat(rate, FIAT)}`;
  }
  const rate = idr * XLM_USD * (1 + markupBps / 10_000);
  return `1 XLM = ${formatFiat(rate, FIAT)}`;
}

export function estimatedMonthlyYield(deposited: number, asset: LiquidityAsset, apy: number) {
  const fiat =
    asset === "USDC"
      ? deposited * CURRENCY_RATES.IDR
      : deposited * XLM_USD * CURRENCY_RATES.IDR;
  return (fiat * apy) / 100 / 12;
}

export function totalStats(positions: LiquidityPosition[]) {
  const earnedFiat = positions.reduce((s, p) => s + p.earnedFiat, 0);
  const activeLiquidity = positions.reduce((s, p) => {
    const fiat =
      p.asset === "USDC"
        ? p.deposited * CURRENCY_RATES.IDR
        : p.deposited * XLM_USD * CURRENCY_RATES.IDR;
    return s + fiat;
  }, 0);
  const avgApy =
    positions.length === 0
      ? 0
      : positions.reduce((s, p) => s + p.apy, 0) / positions.length;
  return { earnedFiat, activeLiquidity, avgApy, count: positions.length };
}
