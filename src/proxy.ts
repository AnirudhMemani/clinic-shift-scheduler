import NextAuth from "next-auth";

import { authConfig } from "@/auth/config";

// Next.js 16 renamed the `middleware` convention to `proxy`. This uses only the
// edge-safe config (no DB/bcrypt); the `authorized` callback in authConfig
// decides who may proceed and redirects guests to /login.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, the auth API, and static assets
  // (including the metadata favicon at /icon.svg, which must load for guests).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
