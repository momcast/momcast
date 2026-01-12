import { createClient, type User as SupabaseUser } from '@supabase/supabase-js'

// Supabase Admin Client
// WARNING: This client has full database access. NEVER use it in client-side components.
// It should only be used in Server Actions or Route Handlers (API).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
    ? createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
    : null as unknown as ReturnType<typeof createClient>

/**
 * Syncs a Naver user to Supabase Auth.
 * Uses a deterministic email mapping: naver_{id}@auth.local
 */
export async function findOrCreateUser(naverId: string, email?: string, name?: string) {
    if (!supabaseAdmin) {
        console.warn('Supabase Admin client not initialized. Skipping findOrCreateUser.');
        return null;
    }
    const deterministicEmail = `naver_${naverId}@auth.local`

    // 1. Check if user exists in Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const existingUser = users.find((u: SupabaseUser) => u.email === deterministicEmail)

    if (existingUser) {
        return existingUser
    }

    // 2. Create user if not exists
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: deterministicEmail,
        email_confirm: true,
        user_metadata: {
            full_name: name,
            naver_id: naverId,
            original_email: email // Store actual naver email if provided
        }
    })

    if (createError) throw createError
    return user
}
