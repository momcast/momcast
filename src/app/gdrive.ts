import { google } from 'googleapis';

import { Readable } from 'stream';

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/spreadsheets'
];

// 서비스 계정 인증
const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES
});

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

/**
 * 구글 스프레드시트에 요청 정보 추가
 */
export async function appendToSheet(data: {
    name: string;
    phone: string;
    status: string;
    payment: string;
    videoUrl: string;
    projectName: string;
    requestId: string;
}) {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        if (!spreadsheetId) {
            console.warn('⚠️ GOOGLE_SHEETS_ID not configured. Skipping sheet logging.');
            return;
        }

        // [개선] 시트명 자동 감지 (첫 번째 시트를 타겟으로 함)
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

        console.log(`📊 Target Sheet: "${firstSheetTitle}"`);

        const date = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${firstSheetTitle}!A2`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[
                    date,
                    data.name,
                    data.phone,
                    data.projectName,
                    data.status || '대기 중',
                    data.payment || '미결제',
                    data.videoUrl || '-',
                    data.requestId
                ]]
            }
        });
        console.log('✅ Appended row to Sheet success');
    } catch (error: any) {
        console.error('❌ Google Sheets Append Error:', {
            message: error.message,
            status: error.status,
            details: error.response?.data?.error
        });
    }
}

/**
 * 시안 요청 자료를 구글 드라이브 및 시트와 동기화
 */
export async function syncToGoogleDrive(
    projectName: string,
    requestId: string,
    scenes: { content?: string; defaultContent?: string; userImageUrl?: string }[],
    userInfo: { name: string; phone: string; email: string }
) {
    try {
        const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // 상위 폴더 ID

        // 1. 요청별 폴더 생성 (폴더명에 유저명/폰번호 포함)
        const safeName = userInfo.name.replace(/\s+/g, '');
        const folderMetadata = {
            name: `[시안]_${safeName}_${userInfo.phone.slice(-4)}_${projectName}`,
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

        // 2. 상세 유저 정보 및 문구 요약 파일 생성 (txt)
        const summaryText = `[사용자 정보]
이름: ${userInfo.name}
연락처: ${userInfo.phone}
이메일: ${userInfo.email}
프로젝트: ${projectName}
요청ID: ${requestId}
일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

------------------------------------

[장면별 문구 요약]
${scenes.map((s, i) => `[장면 ${i + 1}]\n문구: ${s.content || s.defaultContent || '(없음)'}\n---`).join('\n\n')}`;

        await drive.files.create({
            requestBody: {
                name: `기본정보_${safeName}.txt`,
                parents: [folderId],
            },
            media: {
                mimeType: 'text/plain',
                body: summaryText,
            },
        });

        // 3. 구글 시트 대시보드 업데이트
        await appendToSheet({
            name: userInfo.name,
            phone: userInfo.phone,
            projectName: projectName,
            status: '시안요청',
            payment: '-',
            videoUrl: '-',
            requestId: requestId
        });

        // 4. 이미지 업로드 (R2 URL로부터 fetch하여 G-Drive에 업로드)
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

/**
 * 구글 스프레드시트의 특정 요청 상태 업데이트
 */
export async function updateSheetStatus(requestId: string, status: string, videoUrl: string) {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        if (!spreadsheetId) return;

        // 1. 전체 데이터 가져오기 (요청 ID를 찾기 위해)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A:H',
        });

        const rows = response.data.values;
        if (!rows) return;

        // 2. 요청 ID가 일치하는 행 인덱스 찾기 (H열이 ID)
        const rowIndex = rows.findIndex(row => row[7] === requestId);
        if (rowIndex === -1) {
            console.warn(`⚠️ Request ID ${requestId} not found in sheet.`);
            return;
        }

        const realRowIndex = rowIndex + 1; // 1-indexed

        // 3. 상태(E열) 및 영상URL(G열) 업데이트
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Sheet1!E${realRowIndex}:G${realRowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[status, rows[rowIndex][5], videoUrl]] // F열(결제)은 유지
            }
        });

        console.log(`✅ Updated status in Sheet for row ${realRowIndex}`);
    } catch (error) {
        console.error('❌ Google Sheets Update Error:', error);
    }
}
