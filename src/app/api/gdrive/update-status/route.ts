import { NextResponse } from 'next/server';
import { updateSheetStatus } from '../../../gdrive';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { requestId, status, resultUrl } = body;

        if (!requestId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await updateSheetStatus(requestId, status, resultUrl || '-');

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('API Error:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
