import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requestId, status, videoUrl } = body;

        console.log(`[Render Webhook] 📥 Received callback for request: ${requestId}, status: ${status}`);

        if (!requestId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const updateData: any = {
            render_status: status, // 'completed', 'failed', etc.
            updated_at: new Date().toISOString()
        };

        if (videoUrl) {
            updateData.video_url = videoUrl;
            updateData.rendered_at = new Date().toISOString();
        }

        const { error } = await supabaseAdmin
            .from('requests')
            .update(updateData)
            .eq('id', requestId);

        if (error) {
            console.error('[Render Webhook] ❌ DB Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        console.log(`[Render Webhook] ✅ Success: Request ${requestId} updated to ${status}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Render Webhook] 💥 Fatal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
