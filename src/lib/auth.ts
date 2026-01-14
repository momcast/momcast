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
                // 특정 이메일인 경우 어드민 권한 부여
                if (user.email === 'new2jjang@empas.com') {
                    token.role = 'admin';
                } else {
                    token.role = 'user';
                }
            }
            return token;
        },
        async session({ session, token }): Promise<Session> {
            if (session.user) {
                (session.user as { id?: string | number, role?: string }).id = token.id as string;
                (session.user as { id?: string | number, role?: string }).role = token.role as string;
            }
            return session;
        },
    },
};
