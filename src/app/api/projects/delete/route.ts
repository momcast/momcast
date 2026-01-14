import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await req.json();

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        // 보안 확인: 어드민이거나 소유자여야 함
        const isAdmin = (session.user as { role?: string }).role === 'admin';

        if (!isAdmin) {
            // 소유자 확인을 위한 조회
            const { data: project, error: fetchError } = await supabaseAdmin
                .from('projects')
                .select('user_id')
                .eq('id', id)
                .single();

            if (fetchError || !project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }

            if (project.user_id !== (session.user as { id?: string }).id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const { error: deleteError } = await supabaseAdmin
            .from('projects')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Delete Project Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
