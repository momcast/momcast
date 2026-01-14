import { NextResponse } from 'next/server';
import { syncToGoogleDrive } from '../../../gdrive';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectName, requestId, scenes } = body;

        if (!projectName || !requestId || !scenes) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const folderId = await syncToGoogleDrive(projectName, requestId, scenes);

        return NextResponse.json({ success: true, folderId });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('API Error:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
