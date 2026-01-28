import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabaseClient';

export async function POST(req: Request) {
    try {
        const { requestId, projectId, scenes, templateId } = await req.json();

        console.log('[Render Submit] Starting render job:', { requestId, projectId, templateId });

        // TODO: 렌더 서버 주소를 환경변수로 설정
        const renderServerUrl = process.env.RENDER_SERVER_URL || 'http://localhost:3001';

        // 렌더 서버에 작업 전송
        try {
            const renderResponse = await fetch(`${renderServerUrl}/render`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requestId,
                    templateId,
                    projectId,
                    scenes,
                    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/render/webhook`
                })
            });

            if (!renderResponse.ok) {
                throw new Error(`Render server error: ${renderResponse.statusText}`);
            }

            console.log('[Render Submit] Job sent to render server successfully');
        } catch (renderError) {
            console.error('[Render Submit] Failed to contact render server:', renderError);
            // 렌더 서버에 연결 실패해도 상태는 processing으로 설정 (나중에 재시도 가능)
        }

        // Supabase에서 요청 상태 업데이트
        const { error } = await supabase
            .from('user_requests')
            .update({
                render_status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) {
            console.error('[Render Submit] Failed to update status:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Render job submitted successfully'
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[Render Submit] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
