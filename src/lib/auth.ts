import NextAuth, { CredentialsSignin } from "next-auth";
import { createHash } from "node:crypto";
import { callerId, hit, isOverLimit } from "@/lib/rate-limit";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      schoolId: string | null;
      name: string;
      email: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    schoolId: string | null;
  }
}

// Thrown when someone has failed to sign in too often; the login form shows a wait message.
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

const LOGIN_WINDOW_SEC = 900; // 15 minutes
const PER_ACCOUNT_LIMIT = 8; // wrong passwords for one account, from one place
const PER_CALLER_LIMIT = 40; // wrong passwords from one place across all accounts

/** The counters for this attempt, or null if the caller can't be identified (then no throttling). */
async function loginKeys(email: string) {
  try {
    const caller = await callerId();
    const account = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
    return { account: `login:${caller}:${account}`, caller: `login-all:${caller}` };
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const keys = await loginKeys(email);
        if (keys) {
          const [account, caller] = await Promise.all([isOverLimit(keys.account, PER_ACCOUNT_LIMIT, LOGIN_WINDOW_SEC), isOverLimit(keys.caller, PER_CALLER_LIMIT, LOGIN_WINDOW_SEC)]);
          if (!account.allowed || !caller.allowed) throw new TooManyAttempts();
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = !!user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
        if (!user || !valid) {
          // Only failures count, so signing in correctly is never blocked by earlier good logins.
          if (keys) await Promise.all([hit(keys.account, PER_ACCOUNT_LIMIT, LOGIN_WINDOW_SEC), hit(keys.caller, PER_CALLER_LIMIT, LOGIN_WINDOW_SEC)]);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
        token.schoolId = (user as { schoolId: string | null }).schoolId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.schoolId = token.schoolId;
      return session;
    },
  },
});
