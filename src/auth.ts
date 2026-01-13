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
            checks: [],
        }),
    ],
    callbacks: {
        async jwt({ token, user, account }) {
            // 첫 로그인 시 user 정보를 token에 저장
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.picture = user.image;
            }
            return token;
        },
        async session({ session, token }) {
            // token 정보를 session에 복사
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                session.user.image = token.picture as string;
            }
            return session;
        },
    },
})
