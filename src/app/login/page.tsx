import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Clinic Shift Scheduler</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Sign in to manage or claim shifts.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
