import { requireManager } from "@/auth/guards";
import type { ImportIssue } from "@/db/schema";
import { UploadForm } from "@/features/import/components/upload-form";
import { getLatestImportBatch } from "@/features/import/service";

export const dynamic = "force-dynamic";

const ACTION_ORDER: Record<ImportIssue["action"], number> = {
  rejected: 0,
  merged: 1,
  repaired: 2,
};

const ACTION_STYLE: Record<ImportIssue["action"], string> = {
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  merged: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  repaired: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/15">
      <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-black/55 dark:text-white/55">{label}</div>
    </div>
  );
}

function EntitySummary({
  title,
  counts,
}: {
  title: string;
  counts: { accepted: number; repaired: number; merged: number; rejected: number };
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-black/70 dark:text-white/70">
        {title} — {counts.accepted + counts.repaired} imported
      </h2>
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Accepted" value={counts.accepted} tone="text-emerald-600 dark:text-emerald-400" />
        <StatTile label="Repaired" value={counts.repaired} tone="text-sky-600 dark:text-sky-400" />
        <StatTile label="Merged" value={counts.merged} tone="text-amber-600 dark:text-amber-400" />
        <StatTile label="Rejected" value={counts.rejected} tone="text-red-600 dark:text-red-400" />
      </div>
    </div>
  );
}

export default async function ImportReportPage() {
  await requireManager();
  const batch = await getLatestImportBatch();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Import Report</h1>

      <div className="mt-6">
        <UploadForm />
      </div>

      {!batch ? (
        <p className="mt-6 rounded-lg border border-dashed border-black/15 px-6 py-16 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          No imports yet. Run the seed or upload a CSV.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            {batch.source === "seed" ? "Automatic seed import" : "Manual upload"}
            {batch.filename ? ` · ${batch.filename}` : ""} ·{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(batch.createdAt)}
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <EntitySummary title="Staff" counts={batch.summary.staff} />
            <EntitySummary title="Shifts" counts={batch.summary.shifts} />
          </div>

          <h2 className="mt-10 mb-3 text-lg font-semibold">
            Rows needing attention ({batch.issues.length})
          </h2>

          {batch.issues.length === 0 ? (
            <p className="text-sm text-black/55 dark:text-white/55">
              Every row imported cleanly.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...batch.issues]
                .sort(
                  (a, b) =>
                    ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
                    a.entity.localeCompare(b.entity),
                )
                .map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-black/10 p-3 dark:border-white/15"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ACTION_STYLE[issue.action]}`}
                      >
                        {issue.action}
                      </span>
                      <span className="text-xs capitalize text-black/45 dark:text-white/45">
                        {issue.entity}
                      </span>
                      <span className="text-sm">{issue.reason}</span>
                    </div>
                    <code className="block overflow-x-auto whitespace-pre rounded bg-black/5 px-2 py-1 text-xs text-black/70 dark:bg-white/10 dark:text-white/70">
                      {issue.raw}
                    </code>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
