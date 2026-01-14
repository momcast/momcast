import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        // 어드민 권한 확인
        if (!session || !session.user || (session.user as { role?: string }).role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        // Fetch requests with project details and user profile using admin client
        const { data, error } = await supabaseAdmin
            .from('requests')
            .select(`
                *,
                projects ( name, scenes ),
                profiles ( name, email )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Admin Fetch Error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('API List Requests Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
