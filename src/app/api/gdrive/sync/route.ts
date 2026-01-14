import { NextResponse } from 'next/server';
import { syncToGoogleDrive } from '../../../gdrive';

export async function POST(request: Request) {
    try {
        console.log('🚀 Starting Google Drive Sync...');
        const body = await request.json();
        const { projectName, requestId, scenes, userInfo } = body;

        if (!projectName || !requestId || !scenes || !userInfo) {
            console.error('❌ Sync Error: Missing required fields', { projectName, requestId, userInfo: !!userInfo, scenesCount: scenes?.length });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`📂 Syncing project: "${projectName}" (Request ID: ${requestId}) for user: ${userInfo.email}`);

        const folderId = await syncToGoogleDrive(projectName, requestId, scenes, userInfo);

        console.log(`✅ Sync Completed. G-Drive Folder ID: ${folderId}`);
        return NextResponse.json({ success: true, folderId });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('❌ G-Drive Sync API Error:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
