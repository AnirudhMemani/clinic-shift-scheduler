import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { users } from "@/db/schema";

import { authConfig } from "./config";
import { verifyPassword } from "./password";
import { loginSchema } from "./validation";

/**
 * Full Auth.js instance. Extends the edge-safe base config with the Credentials
 * provider, whose `authorize` runs only in the Node runtime (it touches the DB
 * and bcrypt).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        // Never trust the shape of incoming credentials — validate first.
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user) return null;

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) return null;

        // This object seeds the JWT (see the `jwt` callback in ./config.ts).
        // Never include the password hash.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profession: user.profession,
        };
      },
    }),
  ],
});
