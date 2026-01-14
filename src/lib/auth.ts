import { type NextAuthOptions } from "next-auth"
import NaverProvider from "next-auth/providers/naver"
import { type JWT } from "next-auth/jwt"
import { type Session } from "next-auth"

export const authOptions: NextAuthOptions = {
    providers: [
        NaverProvider({
            clientId: process.env.AUTH_NAVER_ID!,
            clientSecret: process.env.AUTH_NAVER_SECRET!,
        }),
    ],
    secret: process.env.AUTH_SECRET,
    callbacks: {
        async jwt({ token, user }): Promise<JWT> {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }): Promise<Session> {
            if (session.user) {
                (session.user as { id?: string | number }).id = token.id as string;
            }
            return session;
        },
    },
};
