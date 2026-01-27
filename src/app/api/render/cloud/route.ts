import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { template, userImages, userTexts } = body;

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = process.env.GITHUB_REPO_OWNER;
        const GITHUB_REPO = process.env.GITHUB_REPO_NAME;

        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            console.error("Missing GitHub configuration in environment");
            return NextResponse.json({ error: "Cloud configuration missing" }, { status: 500 });
        }

        const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`, {
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
                    timestamp: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`❌ GitHub Dispatch Failed [${res.status}]:`, errText);
            return NextResponse.json({
                error: `GitHub API error (${res.status}). Ensure the repository exists on GitHub and the token is valid.`,
                details: errText
            }, { status: res.status });
        }

        return NextResponse.json({ success: true, message: "Cloud rendering started" });
    } catch (error: any) {
        console.error("Cloud Render API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
