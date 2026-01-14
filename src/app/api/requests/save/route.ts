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

        const requestData = await req.json();

        // 필수 필드 검증
        if (!requestData.project_id || !requestData.user_id || !requestData.type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 보안 확인: 본인의 요청이어야 함
        const currentUserId = (session.user as { id?: string }).id;
        const isAdmin = (session.user as { role?: string }).role === 'admin';

        if (requestData.user_id !== currentUserId && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        // [추가] 프로필 정보 동기화 (네이버 등 소셜 로그인 유저를 위해)
        // 향후 어드민 목록에서 이름/이메일을 조인할 때 필수입니다.
        const userId = (session.user as { id?: string }).id;
        await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                email: session.user.email,
                name: session.user.name || session.user.email?.split('@')[0],
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        // requests 테이블에 삽입
        const { data, error } = await supabaseAdmin
            .from('requests')
            .insert({
                project_id: requestData.project_id,
                user_id: requestData.user_id,
                type: requestData.type,
                contact_info: requestData.contact_info || '',
                status: 'pending'
            })
            .select();

        if (error) {
            console.error('Supabase Insert Error:', error);
            return NextResponse.json({
                error: '데이터베이스 저장 실패',
                message: error.message,
                details: error.details
            }, { status: 400 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: '생성된 요청 데이터를 찾을 수 없습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: data[0].id });
    } catch (error: unknown) {
        console.error('API Save Request Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
