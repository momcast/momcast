import NextAuth from "next-auth"
import NaverProvider from "next-auth/providers/naver"

const handler = NextAuth({
    providers: [
        NaverProvider({
            clientId: process.env.AUTH_NAVER_ID!,
            clientSecret: process.env.AUTH_NAVER_SECRET!,
        }),
    ],
    secret: process.env.AUTH_SECRET,
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // @ts-expect-error: NextAuth v4 session user type mismatch
                session.user.id = token.id;
            }
            return session;
        },
    },
    // v4에서는 pages 설정이 없어도 기본 페이지를 제공하므로 안정적입니다.
})

export { handler as GET, handler as POST }

