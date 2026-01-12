import { createClient } from '@supabase/supabase-js'

// Supabase 프로젝트 정보
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mrnjoopluhzjoalqvpov.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmpvb3BsdWh6am9hbHF2cG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjcwNDcsImV4cCI6MjA4Mzc0MzA0N30.GqrbytubIw87FPIQZllmTbXT2lssrk36PuWhiQc_vyY'

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 타입 정의
export interface UserProfile {
    id: string
    email: string
    name?: string
    role: 'user' | 'admin'
    created_at?: string
}

export interface Project {
    id: string
    user_id: string
    template_id: string
    name: string
    scenes: unknown[]
    expires_at: string
    created_at?: string
}

export interface UserRequest {
    id: string
    user_id: string
    project_id: string
    type: 'draft' | 'final'
    contact_info: string
    status: 'pending' | 'processing' | 'completed'
    created_at?: string
}
