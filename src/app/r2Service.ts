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
    console.log("[R2Service] Attempting upload via Server Proxy API...");

    try {
        const formData = new FormData();
        // File 객체가 아닌 Blob일 경우 이름을 수동 지정
        const fileToUpload = file instanceof File ? file : new File([file], fileName || 'image.png', { type: file.type });
        formData.append('file', fileToUpload);

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

        // 업로드 실패 시 로컬에서 즉시 사용할 수 있도록 Base64로 전환
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
