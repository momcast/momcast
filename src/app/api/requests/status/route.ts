import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // 어드민 권한 확인
        const isAdmin = (session?.user as { role?: string })?.role === 'admin' || session?.user?.email === 'new2jjang@empas.com';
        if (!session || !session.user || !isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { requestId, status, resultUrl } = await req.json();

        if (!requestId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const { error } = await supabaseAdmin
            .from('requests')
            .update({ status, result_url: resultUrl })
            .eq('id', requestId);

        if (error) {
            console.error('Supabase Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Update Request Status Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
