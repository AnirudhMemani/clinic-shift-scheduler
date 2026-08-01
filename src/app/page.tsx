import Link from "next/link";

import { signOut } from "@/auth";
import { requireUser } from "@/auth/guards";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Clinic Shift Scheduler</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Signed in as <span className="font-medium">{user.name}</span> (
          {user.email})
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-black/50 dark:text-white/50">Role</dt>
        <dd className="font-medium capitalize">{user.role}</dd>
        {user.profession ? (
          <>
            <dt className="text-black/50 dark:text-white/50">Profession</dt>
            <dd className="font-medium capitalize">{user.profession}</dd>
          </>
        ) : null}
      </dl>

      <nav className="flex gap-3">
        <Link
          href="/shifts"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {user.role === "manager" ? "Manage shifts" : "Browse shifts"}
        </Link>
      </nav>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
