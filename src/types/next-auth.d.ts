import type { DefaultSession } from "next-auth";

import type { Profession, Role } from "@/db/schema";

/**
 * Augment Auth.js types so `role`, `profession`, and `id` are first-class on the
 * session, the user returned by `authorize`, and the JWT.
 */
declare module "next-auth" {
  interface User {
    role: Role;
    profession: Profession | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      profession: Profession | null;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` only re-exports (`export *`) the JWT interface from
// `@auth/core/jwt`, so augmenting "next-auth/jwt" would declare a *new* local
// interface instead of merging. Augment the module that actually declares JWT.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    profession: Profession | null;
  }
}
