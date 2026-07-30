import type { NextAuthConfig } from "next-auth";

/**
 * Base Auth.js configuration.
 *
 * This file is deliberately **edge-safe**: it imports no database client, no
 * bcrypt, and no Node-only APIs, so it can be loaded by `middleware.ts` (which
 * runs on the edge runtime). The Credentials provider — which needs the DB and
 * bcrypt — is added on top of this in `./index.ts`, which only runs in Node.
 *
 * The split is the standard Auth.js v5 pattern for using Credentials without
 * dragging Node dependencies into the edge middleware bundle.
 */

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ["/login"];

export const authConfig = {
  // Credentials provider only supports the JWT strategy (no DB sessions), so
  // role/profession travel in the token — see the callbacks below.
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  // Real providers are attached in ./index.ts; kept empty here so this module
  // stays edge-safe.
  providers: [],
  callbacks: {
    /**
     * Runs in middleware for every matched request. Returning false redirects
     * an unauthenticated visitor to the sign-in page.
     */
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
      if (isPublic) return true;
      return isLoggedIn;
    },
    /** Persist identity + role/profession onto the JWT at sign-in. */
    jwt({ token, user }) {
      // `user` is only present at sign-in. Its base `id` is optional, so narrow
      // on it — our `authorize` always returns id/role/profession together.
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.profession = user.profession;
      }
      return token;
    },
    /** Expose id/role/profession to the app via the session object. */
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.profession = token.profession;
      return session;
    },
  },
} satisfies NextAuthConfig;
