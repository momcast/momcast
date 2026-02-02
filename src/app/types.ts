
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: 'admin' | 'user';
}

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Sticker {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
}

export interface DrawPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface BaseScene {
  id: string;
  rotation: number;
  zoom: number;
  position: { x: number; y: number };
  backgroundMode: 'transparent' | 'solid' | 'blur';
  backgroundColor: string;
  cropRect: Rect;
  stickers: Sticker[];
  drawings: DrawPath[];
  width?: number;
  height?: number;
  name?: string;
  order?: number;
}

export interface Slot {
  id: string;
  name: string;
  isEditable: boolean;
}

export interface SceneSlots {
  photos: Slot[];
  texts: Slot[];
}


// 관리자가 설정하는 장면 (가이드용)
export interface AdminScene extends BaseScene {
  overlayUrl?: string;
  defaultContent: string;
  aeLayerName?: string;        // AE 레이어 이름 (렌더링 매핑용)
  allowUserUpload?: boolean;   // 사진 업로드 허용 여부 (Legacy)
  allowUserDecorate?: boolean; // 꾸미기(스티커/그리기) 허용 여부
  allowUserText?: boolean;     // 문구 작성 허용 여부 (Legacy)
  slots?: SceneSlots;         // 재귀적 검색으로 찾은 상세 슬롯 정보 ⭐
  previewFrame?: number;       // 프리뷰 기준 프레임 (대부분 0)
}


// 템플릿 정보
export interface Template {
  id: string;
  name: string;
  sceneCount: number;
  width?: number;
  height?: number;
  scenes: AdminScene[];
  created_at: string;
}

// 사용자가 실제로 작업한 데이터
export interface UserScene extends BaseScene {
  userImageUrl?: string;
  content: string;
  slotImages?: Record<string, string>; // slotId -> url
  slotTexts?: Record<string, string>;  // slotId -> text
}


export interface UserProject {
  id: string;
  templateId: string;
  userId: string;
  projectName: string;
  userScenes: UserScene[];
  status: 'draft' | 'requested' | 'finalized';
  created_at: string;
  expires_at: string;
}

// UI용 리퀘스트 타입 (camelCase)
export interface UserRequest {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  type: 'draft' | 'final';
  status: 'pending' | 'processing' | 'completed';
  renderStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  renderProgress?: number;
  videoUrl?: string;
  renderedAt?: string;
  contactInfo: string;
  resultUrl?: string;
  createdAt: string;
  userScenes: (AdminScene | UserScene)[]; // Using specific union type instead of any[]
}
