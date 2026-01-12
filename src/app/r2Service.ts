import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 환경 변수 (나중에 .env 파일에서 설정)
const R2_ACCOUNT_ID = process.env.NEXT_PUBLIC_VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.NEXT_PUBLIC_VITE_R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.NEXT_PUBLIC_VITE_R2_SECRET_KEY;
const R2_BUCKET = process.env.NEXT_PUBLIC_VITE_R2_BUCKET || "momcast-photos";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_VITE_R2_PUBLIC_URL; // 예: https://pub-xxxxx.r2.dev

// S3 호환 클라이언트 초기화
let s3Client: S3Client | null = null;

const initR2Client = () => {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
        console.warn("⚠️ R2 credentials not configured. Image upload will use fallback (base64).");
        return null;
    }

    if (!s3Client) {
        s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY,
                secretAccessKey: R2_SECRET_KEY,
            },
        });
    }
    return s3Client;
};

/**
 * R2에 이미지 업로드
 * @param file - 업로드할 이미지 Blob
 * @param fileName - 파일명 (선택)
 * @returns 업로드된 이미지의 Public URL
 */
export const uploadImageToR2 = async (
    file: Blob,
    fileName?: string
): Promise<string> => {
    const client = initR2Client();

    // R2가 설정되지 않은 경우 Base64 폴백
    if (!client) {
        console.warn("🔄 Using base64 fallback for image storage");
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    }

    try {
        // 고유한 파일명 생성
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const extension = fileName?.split('.').pop() || 'png';
        const key = `uploads/${timestamp}_${randomStr}.${extension}`;

        // R2에 업로드
        await client.send(
            new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
                Body: file,
                ContentType: file.type || 'image/png',
            })
        );

        // Public URL 반환
        const publicUrl = R2_PUBLIC_URL
            ? `${R2_PUBLIC_URL}/${key}`
            : `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;

        console.log("✅ Image uploaded to R2:", publicUrl);
        return publicUrl;

    } catch (error) {
        console.error("❌ R2 upload failed, using base64 fallback:", error);
        // 업로드 실패시 Base64 폴백
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
    }
};

/**
 * Canvas를 Blob으로 변환 후 R2 업로드
 */
export const uploadCanvasToR2 = async (
    canvas: HTMLCanvasElement,
    fileName?: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error("Failed to convert canvas to blob"));
                return;
            }
            try {
                const url = await uploadImageToR2(blob, fileName);
                resolve(url);
            } catch (error) {
                reject(error);
            }
        }, 'image/png');
    });
};
