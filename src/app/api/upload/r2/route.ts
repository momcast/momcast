import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Initial env check (will be re-checked inside handler for safety)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.NEXT_PUBLIC_VITE_R2_ACCOUNT_ID;

// Helper to get S3 client with current environment variables
function getS3Client() {
    const id = process.env.R2_ACCOUNT_ID || process.env.NEXT_PUBLIC_VITE_R2_ACCOUNT_ID;
    const ak = process.env.R2_ACCESS_KEY || process.env.NEXT_PUBLIC_VITE_R2_ACCESS_KEY;
    const sk = process.env.R2_SECRET_KEY || process.env.NEXT_PUBLIC_VITE_R2_SECRET_KEY;

    if (!id || !ak || !sk) {
        console.error("[R2-API] Missing credentials at runtime:", {
            id: id ? "exists" : "MISSING",
            ak: ak ? "exists" : "MISSING",
            sk: sk ? "exists" : "MISSING"
        });
        return null;
    }

    console.log("[R2-API] Initializing S3 Client with ID:", id.substring(0, 6) + "...");

    return new S3Client({
        region: "auto",
        endpoint: `https://${id}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: ak,
            secretAccessKey: sk,
        },
        forcePathStyle: true, // R2 supports both, but path style is sometimes more stable
    });
}

const BUCKET = process.env.R2_BUCKET || "momcast-photos";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_VITE_R2_PUBLIC_URL;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        console.log("[R2-API] Upload request received.");
        const s3 = getS3Client();

        if (!s3) {
            return NextResponse.json({
                error: "R2 credentials not configured on server",
                details: {
                    ID: !!(process.env.R2_ACCOUNT_ID),
                    AK: !!(process.env.R2_ACCESS_KEY),
                    SK: !!(process.env.R2_SECRET_KEY)
                }
            }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const extension = file.name.split('.').pop() || 'png';
        const key = `uploads/${timestamp}_${randomStr}.${extension}`;

        console.log(`[R2-API] Uploading to R2: ${key} (${buffer.length} bytes)`);

        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buffer,
                ContentType: file.type || 'image/png',
            })
        );

        const accountId = process.env.R2_ACCOUNT_ID || process.env.NEXT_PUBLIC_VITE_R2_ACCOUNT_ID;
        const publicUrl = PUBLIC_URL
            ? `${PUBLIC_URL}/${key}`
            : `https://pub-${accountId}.r2.dev/${key}`;

        console.log("[R2-API] Upload Success:", publicUrl);
        return NextResponse.json({ url: publicUrl });

    } catch (error: any) {
        console.error("[R2-API] Critical Upload Error:", error);
        return NextResponse.json({
            error: error.message || "Upload failed",
            code: error.code || "UNKNOWN",
            details: error.$metadata
        }, { status: 500 });
    }
}
