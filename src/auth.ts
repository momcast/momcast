import NextAuth, { type DefaultSession, type User } from "next-auth"
import type { JWT } from "next-auth/jwt"
import NaverProvider from "next-auth/providers/naver"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
        } & DefaultSession["user"]
    }

    interface User {
        supabase_uid?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        supabase_uid?: string
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET,
    trustHost: true, // Trust the host header (required for Vercel)
    providers: [
        NaverProvider({
            clientId: process.env.AUTH_NAVER_ID,
            clientSecret: process.env.AUTH_NAVER_SECRET,
            checks: ["nonce"],
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            const t = token as JWT;
            if (user) {
                t.supabase_uid = (user as User).supabase_uid;
            }
            return t;
        },
        async session({ session, token }) {
            if (token.supabase_uid && session.user) {
                session.user.id = token.supabase_uid as string;
            }
            return session;
        },
    },
})
