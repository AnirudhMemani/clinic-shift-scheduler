"use client";

import { useActionState } from "react";

import { claimAction, unclaimAction, type ClaimActionState } from "../actions";

/**
 * Staff-facing claim/unclaim control for one shift.
 * - claimed: shows "Claimed" + an Unclaim button.
 * - claimable: shows a Claim button (server still enforces every rule).
 * - otherwise: a short reason (fully staffed / not needed).
 */
export function StaffClaimControls({
  shiftId,
  claimed,
  claimable,
  reason,
}: {
  shiftId: string;
  claimed: boolean;
  claimable: boolean;
  reason?: string;
}) {
  const [state, formAction, pending] = useActionState<
    ClaimActionState,
    FormData
  >(claimAction.bind(null, shiftId), {});

  if (claimed) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Claimed ✓
        </span>
        <form action={unclaimAction}>
          <input type="hidden" name="shiftId" value={shiftId} />
          <button
            type="submit"
            className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Unclaim
          </button>
        </form>
      </div>
    );
  }

  if (!claimable) {
    return (
      <span className="text-xs text-black/45 dark:text-white/45">{reason}</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Claiming…" : "Claim"}
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="max-w-52 text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
