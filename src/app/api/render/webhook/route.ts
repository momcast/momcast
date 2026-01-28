import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabaseClient';

export async function POST(req: Request) {
    try {
        const { requestId, videoUrl, status, error: renderError } = await req.json();

        console.log('[Render Webhook] Received callback:', { requestId, status, videoUrl });

        // 렌더링 상태 업데이트
        const updateData: {
            render_status: string;
            video_url?: string;
            rendered_at?: string;
            updated_at: string;
        } = {
            render_status: status,
            updated_at: new Date().toISOString()
        };

        if (status === 'completed' && videoUrl) {
            updateData.video_url = videoUrl;
            updateData.rendered_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('user_requests')
            .update(updateData)
            .eq('id', requestId);

        if (error) {
            console.error('[Render Webhook] Failed to update status:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log('[Render Webhook] Status updated successfully:', requestId, status);

        // TODO: 사용자에게 알림 전송 (렌더링 완료 시)
        if (status === 'completed') {
            console.log('[Render Webhook] Render completed, notification should be sent');
            // 여기에 알림 로직 추가 가능
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[Render Webhook] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
