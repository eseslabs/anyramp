const BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `${res.status} ${path}`);
  return body as T;
}

export interface Order {
  orderId: string;
  amountIdr: number;
  usdcAmount: string;
  sellerAddress: string;
  buyerAddress: string | null;
  qrString: string | null;
  totalPayment: number | null;
  status: string;
}

export const api = {
  getOrder: (id: string) => req<Order>(`/orders/${id}`),
  createOrder: (o: {
    orderId: string;
    amountIdr: number;
    usdcAmount: string;
    sellerAddress: string;
  }) => req<Order>('/orders', { method: 'POST', body: JSON.stringify(o) }),
  simulate: (id: string) => req<unknown>(`/orders/${id}/simulate`, { method: 'POST' }),
  prove: (id: string) => req<unknown>(`/orders/${id}/prove`, { method: 'POST' }),
  lock: (id: string) => req<{ hash: string }>(`/orders/${id}/lock`, { method: 'POST' }),
  settle: (id: string, buyerAddress: string) =>
    req<{ xdr: string; networkPassphrase: string }>(`/orders/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ buyerAddress }),
    }),
  submit: (id: string, signedXdr: string) =>
    req<{ hash: string; order: Order }>(`/orders/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ signedXdr }),
    }),
};
