import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import type { Role, UserStatus, Audience } from "@/generated/prisma";

export const { handlers, signIn, signOut, auth, unstable_update: updateSession } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // No password set yet — the account was migrated or admin-created and
        // is still waiting on its activation link. Never sign it in.
        if (!user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Approval gating: only APPROVED users may hold a session.
        if (user.status !== "APPROVED") return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          agency: user.agency,
          audience: user.audience,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
        token.status = (user as { status: UserStatus }).status;
        token.agency = (user as { agency: string }).agency;
        token.audience = (user as { audience: Audience }).audience;
        token.mustChangePassword = (
          user as { mustChangePassword: boolean }
        ).mustChangePassword;
      }
      // Profile edits call updateSession({ user: { name, agency } }) so the
      // cached JWT reflects the new values immediately, without a re-login.
      if (trigger === "update" && session) {
        const next = (session as { user?: { name?: string; agency?: string } })
          .user;
        if (typeof next?.name === "string") token.name = next.name;
        if (typeof next?.agency === "string") token.agency = next.agency;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as UserStatus;
        session.user.agency = token.agency as string;
        session.user.audience = token.audience as Audience;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
});
