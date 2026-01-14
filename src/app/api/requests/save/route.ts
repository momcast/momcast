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

        // 보안 확인: 본인의 요청이어야 함
        const isOwner = requestData.user_id === (session.user as { id?: string }).id;
        const isAdmin = (session.user as { role?: string }).role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const { data: insertedData, error } = await supabaseAdmin
            .from('requests')
            .insert({
                project_id: requestData.project_id,
                user_id: requestData.user_id,
                type: requestData.type,
                contact_info: requestData.contact_info,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
        }

        if (!insertedData) {
            return NextResponse.json({ error: 'Failed to retrieve inserted request data' }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: insertedData.id });
    } catch (error: unknown) {
        console.error('API Save Request Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
