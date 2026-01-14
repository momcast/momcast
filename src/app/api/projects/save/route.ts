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

        const projectData = await req.json();

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const userId = (session.user as { id?: string }).id;
        if (!userId) {
            console.error('API Save Project Error: User ID missing in session');
            return NextResponse.json({ error: '인증 정보에 사용자 ID가 누락되었습니다. 다시 로그인해주세요.' }, { status: 400 });
        }

        // [추가] 프로필 정보 동기화 (Foreign Key 제약 조건 위반 방지)
        try {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    email: session.user.email,
                    name: session.user.name || session.user.email?.split('@')[0]
                }, { onConflict: 'id' });

            if (profileError) {
                console.error('Profile Sync Error:', profileError);
                return NextResponse.json({
                    error: '사용자 프로필 생성을 실패했습니다.',
                    message: profileError.message
                }, { status: 400 });
            }
        } catch (e) {
            console.error('Profile Sync Fatal Error:', e);
        }

        // 보안 확인: 본인의 프로젝트이거나 어드민이어야 함
        const isAdmin = (session.user as { role?: string }).role === 'admin';
        const isOwner = projectData.user_id === userId || projectData.userId === userId;

        if (!isAdmin && !isOwner) {
            return NextResponse.json({
                error: '권한이 없습니다.',
                debug: { userId, projectUserId: projectData.user_id || projectData.userId }
            }, { status: 403 });
        }

        // [핵심] DB 컬럼 매핑 (CamelCase -> SnakeCase)
        const dbProjectData = {
            id: projectData.id || crypto.randomUUID(), // ID가 없으면 생성
            template_id: projectData.template_id || projectData.templateId,
            user_id: userId, // 세션 ID를 우선 사용 (보안)
            name: projectData.name || projectData.projectName || '무제 프로젝트',
            scenes: projectData.scenes || projectData.userScenes || [],
            status: projectData.status || 'draft',
            created_at: projectData.created_at || projectData.createdAt || new Date().toISOString(),
            expires_at: projectData.expires_at || projectData.expiresAt
        };

        if (!dbProjectData.template_id) {
            return NextResponse.json({ error: '템플릿 정보가 누락되었습니다.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('projects')
            .upsert(dbProjectData);

        if (error) {
            console.error('Supabase Project Upsert Error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                data: dbProjectData
            });
            return NextResponse.json({
                error: '데이터베이스 저장 실패',
                message: error.message,
                hint: error.hint,
                code: error.code
            }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Save Project Fatal Error:', error);
        const message = error instanceof Error ? error.stack || error.message : 'Unknown Fatal Error';
        return NextResponse.json({
            error: '서버 내부 오류가 발생했습니다.',
            message: message
        }, { status: 500 });
    }
}
