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

        // [추가] 프로필 정보 동기화 (Foreign Key 제약 조건 위반 방지)
        await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                email: session.user.email,
                name: session.user.name || session.user.email?.split('@')[0],
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        // 보안 확인: 본인의 프로젝트이거나 어드민이어야 함
        const isAdmin = (session.user as { role?: string }).role === 'admin';
        const isOwner = projectData.user_id === userId || projectData.userId === userId;

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // [핵심] DB 컬럼 매핑 (CamelCase -> SnakeCase)
        const dbProjectData = {
            id: projectData.id,
            template_id: projectData.template_id || projectData.templateId,
            user_id: projectData.user_id || projectData.userId,
            name: projectData.name || projectData.projectName,
            scenes: projectData.scenes || projectData.userScenes,
            status: projectData.status,
            created_at: projectData.created_at || projectData.createdAt || new Date().toISOString(),
            expires_at: projectData.expires_at || projectData.expiresAt
        };

        const { error } = await supabaseAdmin
            .from('projects')
            .upsert(dbProjectData);

        if (error) {
            console.error('Supabase Project Upsert Error:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('API Save Project Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
