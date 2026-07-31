"use client";

import { deleteShiftAction } from "../actions";

export function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  return (
    <form
      action={deleteShiftAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this shift? Any claims on it will be removed too.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="shiftId" value={shiftId} />
      <button
        type="submit"
        className="rounded-md border border-red-600/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-600/10 dark:text-red-400"
      >
        Delete
      </button>
    </form>
  );
}
