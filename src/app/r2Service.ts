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
 * R2에 이미지 업로드 (Server Proxy 사용으로 CORS 우회)
 */
export const uploadImageToR2 = async (
    file: Blob,
    fileName?: string
): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('file', file, fileName || 'image.png');

        const response = await fetch('/api/upload/r2', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        console.log("✅ Image uploaded via API:", data.url);
        return data.url;

    } catch (error) {
        console.error("❌ R2 API upload failed, using base64 fallback:", error);
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
