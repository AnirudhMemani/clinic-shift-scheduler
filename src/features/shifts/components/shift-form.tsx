"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PROFESSIONS } from "../validation";
import type { ShiftFormState } from "../actions";

export type ShiftFormDefaults = {
  date: string;
  startTime: string;
  endTime: string;
  requirements: Record<(typeof PROFESSIONS)[number], number>;
  notes: string;
};

const EMPTY_DEFAULTS: ShiftFormDefaults = {
  date: "",
  startTime: "",
  endTime: "",
  requirements: { doctor: 0, nurse: 0, receptionist: 0 },
  notes: "",
};

const fieldClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="text-xs text-red-600 dark:text-red-400">{messages[0]}</p>
  );
}

export function ShiftForm({
  action,
  submitLabel,
  defaults = EMPTY_DEFAULTS,
}: {
  action: (
    state: ShiftFormState,
    formData: FormData,
  ) => Promise<ShiftFormState>;
  submitLabel: string;
  defaults?: ShiftFormDefaults;
}) {
  const [state, formAction, pending] = useActionState<ShiftFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={defaults.date}
          className={fieldClass}
        />
        <FieldError messages={state.errors?.date} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startTime" className="text-sm font-medium">
            Start time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            defaultValue={defaults.startTime}
            className={fieldClass}
          />
          <FieldError messages={state.errors?.startTime} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endTime" className="text-sm font-medium">
            End time
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            defaultValue={defaults.endTime}
            className={fieldClass}
          />
          <FieldError messages={state.errors?.endTime} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-black/50 dark:text-white/50">
        An end time at or before the start is treated as the next day (overnight
        shift).
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Staffing required</legend>
        <div className="grid grid-cols-3 gap-4">
          {PROFESSIONS.map((profession) => (
            <div key={profession} className="flex flex-col gap-1.5">
              <label
                htmlFor={profession}
                className="text-xs capitalize text-black/60 dark:text-white/60"
              >
                {profession}s
              </label>
              <input
                id={profession}
                name={profession}
                type="number"
                min={0}
                max={50}
                defaultValue={defaults.requirements[profession]}
                className={fieldClass}
              />
            </div>
          ))}
        </div>
        <FieldError messages={state.errors?.requirements} />
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes <span className="text-black/40 dark:text-white/40">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
          className={fieldClass}
        />
        <FieldError messages={state.errors?.notes} />
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/shifts"
          className="text-sm text-black/60 underline-offset-4 hover:underline dark:text-white/60"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
