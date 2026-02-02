import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 서버 사이드에서만 사용하는 환경 변수 (NEXT_PUBLIC 생략)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.NEXT_PUBLIC_VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || process.env.NEXT_PUBLIC_VITE_R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || process.env.NEXT_PUBLIC_VITE_R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET || process.env.NEXT_PUBLIC_VITE_R2_BUCKET || "momcast-photos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_VITE_R2_PUBLIC_URL;

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY!,
        secretAccessKey: R2_SECRET_KEY!,
    },
});

// App Router config exports
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Increase timeout for large files

export async function POST(req: NextRequest) {
    try {
        console.log("[R2-API] Upload started...");
        if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
            console.error("[R2-API] Missing credentials:", {
                ID: !!R2_ACCOUNT_ID,
                AK: !!R2_ACCESS_KEY,
                SK: !!R2_SECRET_KEY
            });
            return NextResponse.json({ error: "R2 credentials not configured" }, { status: 500 });
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

        console.log(`[R2-API] Sending to R2 (Key: ${key})...`);
        await s3Client.send(
            new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
                Body: buffer,
                ContentType: file.type || 'image/png',
            })
        );

        const publicUrl = R2_PUBLIC_URL
            ? `${R2_PUBLIC_URL}/${key}`
            : `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;

        console.log("[R2-API] Upload Success:", publicUrl);
        return NextResponse.json({ url: publicUrl });

    } catch (error: any) {
        console.error("[R2-API] Critical Error:", {
            message: error.message,
            code: error.code,
            requestId: error.$metadata?.requestId,
            statusCode: error.$metadata?.httpStatusCode
        });
        return NextResponse.json({
            error: error.message,
            code: error.code,
            details: error.$metadata
        }, { status: 500 });
    }
}
