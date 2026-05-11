import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { verifyPassword } from './password';
import { LoginSchema } from '@repo/api-types';

type AppRole = 'ADMIN' | 'MANAGER' | 'DRIVER';
type AppLanguage = 'en' | 'ko' | 'vi';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      language: AppLanguage;
    } & DefaultSession['user'];
  }

  interface User {
    role: AppRole;
    language: AppLanguage;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const parsed = LoginSchema.safeParse(creds);
        if (!parsed.success) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        if (!user || !user.passwordHash || user.status !== 'ACTIVE') return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          language: user.language,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.language = user.language;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? session.user.id;
        session.user.role = token.role as AppRole;
        session.user.language = token.language as AppLanguage;
      }
      return session;
    },
  },
});
