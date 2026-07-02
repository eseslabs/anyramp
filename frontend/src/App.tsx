import { useState } from 'react';
import { api, type Order } from './api.ts';
import { connectWallet, signXdr } from './freighter.ts';

const EXPLORER = 'https://stellar.expert/explorer/testnet/tx/';

export function App() {
  const [address, setAddress] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [log, setLog] = useState<{ t: 'info' | 'ok' | 'err'; m: string }[]>([]);

  const say = (t: 'info' | 'ok' | 'err', m: string) => setLog((l) => [{ t, m }, ...l].slice(0, 40));

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      say('err', `${label}: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  }

  const refresh = async () => setOrder(await api.getOrder(orderId));

  const connect = () =>
    run('connect', async () => {
      const a = await connectWallet();
      setAddress(a);
      say('ok', `wallet: ${a.slice(0, 6)}…${a.slice(-4)}`);
    });

  const load = () =>
    run('load', async () => {
      await refresh();
      say('ok', `loaded ${orderId}`);
    });

  const createDemo = () =>
    run('create', async () => {
      const id = `ZKP-${Date.now()}`;
      setOrderId(id);
      const o = await api.createOrder({
        orderId: id,
        amountIdr: 120000,
        usdcAmount: '100000000',
        sellerAddress: address || 'GAW24ZON4HHNOOO6SD33ZBZR6DNEFIRWJSIANJ5Q2CYTSC5UCQJEKKQC',
      });
      setOrder(o);
      say('ok', `order ${id} created (QRIS issued)`);
    });

  const lock = () =>
    run('lock', async () => {
      const { hash } = await api.lock(orderId);
      say('ok', `seller locked USDC · tx ${hash.slice(0, 10)}…`);
      await refresh();
    });

  const simulate = () =>
    run('simulate', async () => {
      await api.simulate(orderId);
      say('ok', 'sandbox payment simulated');
      await refresh();
    });

  const prove = () =>
    run('prove', async () => {
      await api.prove(orderId);
      say('ok', 'zkTLS proof generated');
      await refresh();
    });

  const claim = () =>
    run('claim', async () => {
      if (!address) throw new Error('connect wallet first');
      say('info', 'building fulfill transaction…');
      const { xdr } = await api.settle(orderId, address);
      say('info', 'sign in Freighter…');
      const signed = await signXdr(xdr, address);
      const { hash } = await api.submit(orderId, signed);
      say('ok', `USDC released! tx ${hash.slice(0, 10)}…`);
      window.open(EXPLORER + hash, '_blank');
      await refresh();
    });

  return (
    <div className="wrap">
      <header>
        <h1>AnyRamp</h1>
        <p className="tag">Pay Rupiah. Get USDC. No trust required.</p>
        <button className="wallet" onClick={connect} disabled={!!busy}>
          {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect Freighter'}
        </button>
      </header>

      <section className="card">
        <div className="row">
          <input
            placeholder="order id (e.g. ZKP-…)"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <button onClick={load} disabled={!orderId || !!busy}>
            Load
          </button>
          <button onClick={createDemo} disabled={!!busy}>
            New demo order
          </button>
        </div>

        {order && (
          <div className="order">
            <div className="grid">
              <span>Order</span>
              <b>{order.orderId}</b>
              <span>Amount</span>
              <b>Rp {order.amountIdr.toLocaleString('id-ID')}</b>
              <span>USDC locked</span>
              <b>{order.usdcAmount}</b>
              <span>Status</span>
              <b className={`st st-${order.status}`}>{order.status}</b>
            </div>
            {order.qrString && <div className="qr">QRIS: {order.qrString}</div>}
          </div>
        )}
      </section>

      <section className="card steps">
        <h3>Seller</h3>
        <div className="row">
          <button onClick={lock} disabled={!order || !!busy}>
            1 · Lock USDC
          </button>
          <button onClick={simulate} disabled={!order || !!busy}>
            2 · Simulate payment
          </button>
        </div>
        <h3>Buyer</h3>
        <div className="row">
          <button onClick={prove} disabled={!order || !!busy}>
            3 · Generate ZK proof
          </button>
          <button className="primary" onClick={claim} disabled={!order || !address || !!busy}>
            4 · Claim USDC (Freighter)
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Activity {busy && <span className="spin">· {busy}…</span>}</h3>
        <ul className="log">
          {log.map((l, i) => (
            <li key={i} className={l.t}>
              {l.m}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
