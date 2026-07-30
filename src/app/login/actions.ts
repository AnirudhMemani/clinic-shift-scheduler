"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { loginSchema } from "@/auth/validation";

export type LoginState = { error?: string };

/**
 * Login server action. Validates input, then delegates to Auth.js `signIn`.
 *
 * On success `signIn` throws a redirect (NEXT_REDIRECT) which must propagate, so
 * only `AuthError` is caught and turned into a friendly message. We keep the
 * message generic ("invalid email or password") to avoid leaking which field
 * was wrong.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Re-throw redirects and anything unexpected.
    throw error;
  }

  return {};
}
