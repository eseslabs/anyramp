import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Anyramp" },
      {
        name: "description",
        content:
          "Manage the zero-knowledge keys and recovery options that protect your Anyramp wallet on Stellar.",
      },
    ],
  }),
  component: SecurityPage,
});

const rows = [
  { label: "ZK proving key", value: "Active · device-bound", ok: true },
  { label: "Stellar account", value: "GA…XQK7", ok: true },
  { label: "Recovery phrase", value: "Backed up", ok: true },
  { label: "Biometric unlock", value: "On", ok: true },
];

function SecurityPage() {
  return (
    <AppShell>
      <div className="px-5 pt-2">
        <h1 className="font-serif text-3xl tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyramp never custodies your funds. Keys, proofs, and signatures stay on your device.
        </p>
      </div>

      <section className="mt-6 px-4">
        <div className="rounded-3xl bg-surface p-5 shadow-quiet ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <svg className="size-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 1.2c-1.6.9-3.3 1.4-5 1.5v5.4c0 3 2 5.4 5 6.7 3-1.3 5-3.7 5-6.7V2.7c-1.7-.1-3.4-.6-5-1.5Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium">Trustless mode</p>
              <p className="text-xs text-muted-foreground">All checks passing</p>
            </div>
          </div>

          <ul className="mt-5 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between py-3">
                <span className="text-sm text-foreground">{r.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.value}
                  <span
                    className={`size-1.5 rounded-full ${r.ok ? "bg-accent" : "bg-destructive"}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6 px-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Anyramp uses zk-SNARKs to prove that a fiat payment occurred without revealing your bank
          details to your peer or the network. The same proof releases funds from the on-chain
          escrow on Stellar — automatically and trustlessly.
        </p>
      </section>
    </AppShell>
  );
}
