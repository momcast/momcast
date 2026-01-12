
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { uploadImageToR2 } from "./r2Service";

/**
 * Firebase 설정
 * Firestore만 사용 (이미지는 R2로 처리)
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_WEB_API_KEY_HERE",
  authDomain: "gen-lang-client-0340061265.firebaseapp.com",
  projectId: "gen-lang-client-0340061265",
  storageBucket: "gen-lang-client-0340061265.firebasestorage.app",
  messagingSenderId: "472853831475",
  appId: "1:472853831475:web:7fe9a69b189f0688412846"
};

// 키가 아직 입력되지 않았을 경우를 위한 체크
const isConfigReady = firebaseConfig.apiKey !== "YOUR_WEB_API_KEY_HERE";

let db: unknown = null;

if (isConfigReady) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("✅ Firebase Firestore 활성화됨");
  } catch (e) {
    console.error("❌ Firebase 초기화 오류:", e);
  }
}

export { db };

/**
 * 이미지 업로드 함수 (Cloudflare R2 사용)
 * R2가 설정되지 않은 경우 자동으로 base64 폴백 사용
 */
export const uploadImage = async (file: File): Promise<string> => {
  try {
    const url = await uploadImageToR2(file, file.name);
    return url;
  } catch (error) {
    console.error("❌ 이미지 업로드 중 오류:", error);
    // 폴백: base64로 변환
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};
