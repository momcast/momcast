import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { uploadImageToR2 } from "./r2Service";

/**
 * Firebase 설정
 * Firestore (옵션) 로직 유지, 실제 이미지는 R2로 처리
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_WEB_API_KEY_HERE",
  authDomain: "gen-lang-client-0340061265.firebaseapp.com",
  projectId: "gen-lang-client-0340061265",
  storageBucket: "gen-lang-client-0340061265.firebasestorage.app",
  messagingSenderId: "472853831475",
  appId: "1:472853831475:web:7fe9a69b189f0688412846"
};

const isConfigReady = firebaseConfig.apiKey !== "YOUR_WEB_API_KEY_HERE";

let db: unknown = null;

if (isConfigReady) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.warn("Firebase not partially initialized:", e);
  }
}

export { db };

/**
 * 이미지 업로드 함수 (Cloudflare R2 사용 연동)
 */
export const uploadImage = async (file: File): Promise<string> => {
  try {
    // Cloudflare R2로 업로드 시도
    const url = await uploadImageToR2(file, file.name);
    return url;
  } catch (error) {
    console.error("❌ R2 업로드 중 오류:", error);
    alert("이미지 서버(R2) 업로드에 실패했습니다. 환경 변수 설정을 확인해 주세요. (임시로 기본 스토리지에 저장됩니다)");
    // 폴백: base64 (임시)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};
