import { supabase } from './supabaseClient'
import type { UserProfile } from './supabaseClient'
import { signIn as nextAuthSignIn } from "next-auth/react"

/**
 * 이메일/비밀번호로 회원가입
 */
export const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name || email.split('@')[0]
            }
        }
    })

    if (error) throw error
    return data
}

/**
 * 이메일/비밀번호로 로그인
 */
export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) throw error
    return data
}

/**
 * 로그아웃
 */
export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

/**
 * 현재 세션 가져오기
 */
export const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
}

/**
 * 현재 사용자 프로필 가져오기
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Profile fetch error:', error)
        return null
    }

    return profile
}

/**
 * 네이버로 로그인
 */
export const signInWithNaver = async () => {
    // Supabase does not support Naver natively.
    // We use Next-Auth to handle Naver login and sync with Supabase.
    await nextAuthSignIn("naver", { callbackUrl: "/" })
}

/**
 * 인증 상태 변경 리스너
 */
export const onAuthStateChange = (callback: (user: UserProfile | null) => void) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            const profile = await getCurrentUserProfile()
            callback(profile)
        } else {
            callback(null)
        }
    })
}
