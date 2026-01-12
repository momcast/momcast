import { supabaseAdmin } from "./supabase-admin"

const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'momcast-images'

/**
 * Uploads a file to a private Supabase bucket.
 * Uses admin client to bypass RLS for server-side operations.
 */
export async function uploadToPrivateBucket(filePath: string, fileBody: Buffer | Blob, contentType?: string) {
    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBody, {
            contentType,
            upsert: true
        })

    if (error) throw error
    return data
}

/**
 * Generates a signed URL for a file in a private bucket.
 * Necessary for client-side viewing since the bucket is not public.
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600) {
    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn)

    if (error) throw error
    return data.signedUrl
}

/**
 * Deletes a file from the bucket.
 */
export async function deleteFromBucket(filePath: string) {
    const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove([filePath])

    if (error) throw error
    return data
}
