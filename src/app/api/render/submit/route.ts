import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabaseClient';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requestId, projectId, template, userImages, userTexts, projectName, contactInfo } = body;

        console.log('[Render Submit] Starting GitHub Action render job:', { requestId, projectId, projectName });

        // GitHub 설정 가져오기
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = process.env.GITHUB_REPO_OWNER;
        const GITHUB_REPO = process.env.GITHUB_REPO_NAME;

        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            console.error("❌ Missing GitHub configuration in environment");
            return NextResponse.json({ error: "Cloud configuration missing" }, { status: 500 });
        }

        // 1. GitHub Actions 트리거 (Repository Dispatch)
        const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
                event_type: 'render_video',
                client_payload: {
                    template,
                    userImages,
                    userTexts,
                    requestId,
                    contactInfo,
                    projectName,
                    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/render/webhook`,
                    timestamp: new Date().toISOString()
                }
            })
        });

        if (!ghRes.ok) {
            const errText = await ghRes.text();
            console.error(`❌ GitHub Dispatch Failed [${ghRes.status}]:`, errText);
            // 트리거 실패해도 DB 상태는 업데이트하지 않고 에러 반환
            return NextResponse.json({ error: `GitHub API error (${ghRes.status})`, details: errText }, { status: ghRes.status });
        }

        console.log('[Render Submit] GitHub Action triggered successfully');

        // 2. Supabase에서 요청 상태 업데이트
        const { error: dbError } = await supabase
            .from('requests')
            .update({
                render_status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (dbError) {
            console.error('[Render Submit] Failed to update DB status:', dbError);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Render job submitted to GitHub Actions successfully'
        });
    } catch (error: any) {
        console.error('[Render Submit] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
