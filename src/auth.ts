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
            allowDangerousEmailAccountLinking: true, // Allow OAuth account linking
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "naver") {
                try {
                    const naverId = profile?.id as string;
                    if (!naverId) {
                        console.error("Naver ID not found in profile");
                        return false;
                    }

                    // Try to sync with Supabase, but don't block login if it fails
                    const supabaseUser = await findOrCreateUser(
                        naverId,
                        user.email || undefined,
                        user.name || undefined
                    );

                    if (supabaseUser) {
                        user.supabase_uid = supabaseUser.id;
                        console.log("Supabase sync successful:", supabaseUser.id);
                    } else {
                        console.warn("Supabase sync failed, but allowing login to proceed");
                    }

                    return true;
                } catch (error) {
                    console.error("Error syncing user to Supabase:", error);
                    // Allow login even if Supabase sync fails
                    console.warn("Allowing login despite Supabase error");
                    return true;
                }
            }
            return true;
        },
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
