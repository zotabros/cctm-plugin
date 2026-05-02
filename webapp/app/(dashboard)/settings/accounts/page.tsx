export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ACCOUNT_COLORS } from "@cctm/shared";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { HairlineCard } from "@/components/primitives/HairlineCard";
import { updateAccountAction } from "./actions";

export default async function AccountsPage() {
  const session = await auth();

  const accounts = await prisma.account.findMany({
    orderBy: { label: "asc" },
    select: { id: true, label: true, claudeEmail: true, color: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        subtitle="Logical Claude identities aggregated across machines."
      />

      <HairlineCard className="p-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Claude email</th>
              <th className="px-4 py-3 font-mono">30d tokens</th>
              <th className="w-32 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                  No accounts yet. They appear automatically once a machine streams usage.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: a.color }}
                      aria-label={a.label}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateAccountAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        name="label"
                        defaultValue={a.label}
                        className="rounded-md border border-transparent bg-transparent px-2 py-1 text-[13px] text-fg hover:border-border focus:border-accent focus:outline-none"
                      />
                      <select
                        name="color"
                        defaultValue={a.color}
                        className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-fg"
                      >
                        {ACCOUNT_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-border px-2 py-1 text-[11px] text-fg-muted hover:border-border-strong hover:text-fg"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 font-mono text-fg-muted">
                    {a.claudeEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-fg-muted">0</td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </HairlineCard>
    </div>
  );
}
