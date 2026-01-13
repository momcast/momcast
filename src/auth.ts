import NextAuth, { type DefaultSession, type User } from "next-auth"
import type { JWT } from "next-auth/jwt"
import NaverProvider from "next-auth/providers/naver"
import { findOrCreateUser } from "@/lib/supabase-admin"

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
    debug: true, // Enable debug mode to see detailed error messages
    trustHost: true, // Trust the host header (required for Vercel)
    providers: [
        NaverProvider({
            clientId: process.env.AUTH_NAVER_ID,
            clientSecret: process.env.AUTH_NAVER_SECRET,
        }),
    ],
    // Allow automatic account linking for OAuth providers
    // This is needed because we're using a custom email format (naver_{id}@auth.local)
    callbacks: {
        // Removed signIn callback to allow NextAuth to handle authentication automatically
        // Supabase sync will be handled separately after successful login
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
    pages: {
        signIn: "/login",
    },
})
