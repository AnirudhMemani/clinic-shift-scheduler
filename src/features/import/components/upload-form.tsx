"use client";

import { useActionState } from "react";

import { uploadCsvAction, type UploadState } from "../actions";

export function UploadForm() {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    uploadCsvAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-sm font-medium">Upload a CSV</h2>
      <p className="mt-1 text-xs text-black/55 dark:text-white/55">
        Import a staff or shifts export — same cleaning rules as the seed. The
        format is auto-detected.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-black/15 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:border-white/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
