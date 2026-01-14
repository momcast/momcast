import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        // 어드민 권한 확인: 이메일 기반 중복 검증
        const isAdmin = (session?.user as { role?: string })?.role === 'admin' || session?.user?.email === 'new2jjang@empas.com';

        if (!session || !session.user || !isAdmin) {
            console.warn('Unauthorized Admin API Access Attempt:', session?.user?.email);
            return NextResponse.json({
                error: 'Unauthorized',
                debug: { email: session?.user?.email, isAdmin }
            }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        // Fetch requests with project details and user profile using admin client
        // [TIP] 조인 과정에서 데이터가 누락되는지 확인하기 위해 count 우선 확인
        const { count, error: countError } = await supabaseAdmin
            .from('requests')
            .select('*', { count: 'exact', head: true });

        console.log('Admin List RAW Count:', count, countError);

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

        console.log(`Admin List Data Fetched: ${data?.length || 0} items`);
        if (data && data.length > 0) {
            console.log('Sample Item Joins:', {
                hasProject: !!data[0].projects,
                hasProfile: !!data[0].profiles,
                projectId: data[0].project_id,
                userId: data[0].user_id
            });
        }

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('API List Requests Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
