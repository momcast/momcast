/**
 * R2 Service (Server-Proxy Version)
 * 클라이언트 사이드 S3 SDK를 제거하여 CORS 문제를 원천 방어합니다.
 */

/**
 * R2에 이미지 업로드 (Server Proxy 사용으로 CORS 우회)
 */
export const uploadImageToR2 = async (
    file: Blob,
    fileName?: string
): Promise<string> => {
    let fileToUpload: Blob = file;

    // 413 Content Too Large 방지: 4MB 이상인 경우 압축 시도 (이미지인 경우)
    if (file.size > 4 * 1024 * 1024 && file.type.startsWith('image/')) {
        console.log(`[R2Service] File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 4MB. Compressing...`);
        try {
            const compressed = await compressImage(file);
            if (compressed) {
                fileToUpload = compressed;
                console.log(`[R2Service] Compressed to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
            }
        } catch (e) {
            console.warn("[R2Service] Compression failed, trying original file...", e);
        }
    }

    console.log("[R2Service] Attempting upload via Server Proxy API...");

    try {
        const formData = new FormData();
        const finalFile = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], fileName || 'image.png', { type: fileToUpload.type });
        formData.append('file', finalFile);

        const response = await fetch('/api/upload/r2', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Image uploaded via API Success:", data.url);
        return data.url;

    } catch (error: any) {
        console.error("❌ R2 API upload failed, switching to local Base64 fallback:", error);

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const b64 = reader.result as string;
                console.log("🔄 Fallback: Base64 generated successfully.");
                resolve(b64);
            };
            reader.readAsDataURL(file);
        });
    }
};

/**
 * 간단한 캔버스 기반 이미지 압축
 */
async function compressImage(file: Blob): Promise<Blob | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIDE = 2500;
            if (width > MAX_SIDE || height > MAX_SIDE) {
                if (width > height) {
                    height = (height / width) * MAX_SIDE;
                    width = MAX_SIDE;
                } else {
                    width = (width / height) * MAX_SIDE;
                    height = MAX_SIDE;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(null);
    });
}

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
