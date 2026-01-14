import { google } from 'googleapis';

import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.appdata'];

// 서비스 계정 인증
const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES
});

const drive = google.drive({ version: 'v3', auth });

/**
 * 시안 요청 자료를 구글 드라이브로 동기화
 */
export async function syncToGoogleDrive(projectName: string, requestId: string, scenes: { content?: string; defaultContent?: string; userImageUrl?: string }[]) {
    try {
        const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // 상위 폴더 ID

        // 1. 요청별 폴더 생성
        const folderMetadata = {
            name: `[시안]_${projectName}_${requestId.substring(0, 5)}`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentFolderId ? [parentFolderId] : undefined,
        };

        const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });

        const folderId = folder.data.id;
        if (!folderId) throw new Error('Failed to create folder');

        console.log(`✅ Created G-Drive folder: ${folderId}`);

        // 2. 문구 요약 파일 생성 (txt)
        const summaryText = scenes.map((s, i) => `[장면 ${i + 1}]\n문구: ${s.content || s.defaultContent || '(없음)'}\n---`).join('\n\n');
        await drive.files.create({
            requestBody: {
                name: '작성문구_요약.txt',
                parents: [folderId],
            },
            media: {
                mimeType: 'text/plain',
                body: summaryText,
            },
        });

        // 3. 이미지 업로드 (R2 URL로부터 fetch하여 G-Drive에 업로드)
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const imageUrl = scene.userImageUrl;

            if (imageUrl && imageUrl.startsWith('http')) {
                try {
                    const response = await fetch(imageUrl);
                    const buffer = await response.arrayBuffer();

                    await drive.files.create({
                        requestBody: {
                            name: `이미지_${i + 1}.png`,
                            parents: [folderId],
                        },
                        media: {
                            mimeType: 'image/png',
                            body: Readable.from(Buffer.from(buffer)),
                        },
                    });
                    console.log(`  - Uploaded image ${i + 1}`);
                } catch (imgErr) {
                    console.error(`  - Failed to upload image ${i + 1}:`, imgErr);
                }
            }
        }

        return folderId;
    } catch (error) {
        console.error('❌ G-Drive Sync Error:', error);
        throw error;
    }
}
