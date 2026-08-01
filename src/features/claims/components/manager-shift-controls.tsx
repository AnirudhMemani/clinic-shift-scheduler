"use client";

import { useActionState } from "react";

import { assignAction, removeClaimAction, type ClaimActionState } from "../actions";

type Claimant = { userId: string; name: string; profession: string | null };
type AssignableStaff = { id: string; name: string; profession: string | null };

export function ManagerShiftControls({
  shiftId,
  claimants,
  assignableStaff,
}: {
  shiftId: string;
  claimants: Claimant[];
  assignableStaff: AssignableStaff[];
}) {
  const [state, formAction, pending] = useActionState<
    ClaimActionState,
    FormData
  >(assignAction.bind(null, shiftId), {});

  return (
    <div className="flex flex-col gap-3">
      {claimants.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {claimants.map((c) => (
            <li
              key={c.userId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>
                {c.name}
                <span className="ml-1.5 text-xs capitalize text-black/45 dark:text-white/45">
                  {c.profession}
                </span>
              </span>
              <form action={removeClaimAction}>
                <input type="hidden" name="shiftId" value={shiftId} />
                <input type="hidden" name="userId" value={c.userId} />
                <button
                  type="submit"
                  aria-label={`Remove ${c.name}`}
                  className="rounded-md border border-black/15 px-2 py-0.5 text-xs transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-black/45 dark:text-white/45">
          No one assigned yet.
        </p>
      )}

      {assignableStaff.length > 0 ? (
        <form action={formAction} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <select
              name="userId"
              defaultValue=""
              required
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            >
              <option value="" disabled>
                Assign staff to an open role…
              </option>
              {assignableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.profession})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {pending ? "Assigning…" : "Assign"}
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
