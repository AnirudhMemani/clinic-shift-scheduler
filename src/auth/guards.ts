import { redirect } from "next/navigation";

import type { Role } from "@/db/schema";

import { auth } from "./index";

/**
 * Server-side authz helpers for use in Server Components and Server Actions.
 *
 * These enforce access on the server — the security boundary the brief requires.
 * Middleware already redirects logged-out visitors, but these guards also cover
 * role checks and act as defense-in-depth for anything the matcher misses.
 */

/** Require any authenticated user; redirect to /login otherwise. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Require a specific role; send authenticated-but-wrong-role users home. */
export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) redirect("/");
  return user;
}

export function requireManager() {
  return requireRole("manager");
}

export function requireStaff() {
  return requireRole("staff");
}
