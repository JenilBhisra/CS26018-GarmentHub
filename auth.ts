import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const { handlers, auth: nextAuthAuth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: "CUSTOMER" as Role,
          emailVerified: new Date(),
        };
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        redirectTo: { label: "Redirect To", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On sign in, persist the role into the token
      if (user) {
        token.role = (user as { role?: Role }).role ?? "CUSTOMER";
        token.id = user.id!;
      }

      // On update session trigger, refresh role from DB
      if (trigger === "update" && session?.user?.role) {
        token.role = session.user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        // If user doesn't exist yet, it will be created by the adapter with CUSTOMER role
        if (!existing) {
          return true;
        }
      }
      return true;
    },
  },
});

// Only for standalone ts-node scripts (scripts/test-*.ts) run outside the Next.js
// server process. Hard-disabled in production so no live request path can ever
// override auth() for the whole server process.
let testSession: any = null;
export function setMockSessionForTesting(session: any) {
  if (process.env.NODE_ENV === "production") return;
  testSession = session;
}

export const auth = (...args: any[]) => {
  if (args.length > 0 && typeof args[0] === 'function') {
    return (nextAuthAuth as any)(...args);
  }
  if (testSession) {
    return Promise.resolve(testSession);
  }
  return (nextAuthAuth as any)(...args);
};

export { handlers, signIn, signOut };


// Type augmentation for NextAuth session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
    };
  }

  interface User {
    role?: Role;
  }

  interface JWT {
    id: string;
    role: Role;
  }
}
