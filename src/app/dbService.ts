import { type Project } from './supabaseClient'
import type { UserRequest, Template, UserProject } from './types'

/**
 * 시안/최종 요청 저장
 */
export const saveUserRequest = async (request: {
    project_id: string,
    user_id: string,
    type: 'draft' | 'final',
    contact_info: string,
    project_name?: string,
    scenes?: unknown[]
}) => {
    try {
        const response = await fetch('/api/requests/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`${errorData.error}${errorData.message ? ': ' + errorData.message : ''}`);
        }

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error("Error saving request via API:", error);
        throw error;
    }
};

/**
 * 어드민용 모든 요청 목록 가져오기
 */
export const getAdminRequests = async (): Promise<UserRequest[]> => {
    try {
        const response = await fetch('/api/requests/list');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch admin requests');
        }

        const data = await response.json();

        return (data || []).map((req: {
            id: string,
            project_id: string,
            user_id: string,
            type: 'draft' | 'final',
            status: 'pending' | 'processing' | 'completed',
            contact_info: string,
            result_url?: string,
            created_at: string,
            projects?: { name: string, scenes: unknown[] } | null,
            profiles?: { name: string | null, email: string | null } | null
        }) => ({
            id: req.id,
            projectId: req.project_id,
            projectName: req.projects?.name || 'Unknown Project',
            userId: req.user_id,
            userName: req.profiles?.name || req.profiles?.email || 'Unknown User',
            type: req.type,
            status: req.status,
            contactInfo: req.contact_info,
            resultUrl: req.result_url,
            createdAt: req.created_at,
            userScenes: req.projects?.scenes || []
        }));
    } catch (error) {
        console.error("Error fetching admin requests via API:", error);
        return [];
    }
};

/**
 * 사용자 본인의 요청 목록 가져오기
 */
export const getUserRequests = async (_userId: string): Promise<UserRequest[]> => {
    try {
        const response = await fetch('/api/requests/user');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch user requests');
        }

        const data = await response.json();

        return (data || []).map((req: {
            id: string,
            project_id: string,
            user_id: string,
            type: 'draft' | 'final',
            status: 'pending' | 'processing' | 'completed',
            contact_info: string,
            result_url?: string,
            created_at: string,
            projects?: { name: string } | null
        }) => ({
            id: req.id,
            projectId: req.project_id,
            projectName: req.projects?.name || 'Unknown Project',
            userId: req.user_id,
            userName: '',
            type: req.type,
            status: req.status,
            contactInfo: req.contact_info,
            resultUrl: req.result_url,
            createdAt: req.created_at,
            userScenes: []
        }));
    } catch (error) {
        console.error("Error fetching user requests via API:", error);
        return [];
    }
};

/**
 * 프로젝트 저장/업데이트 (본인 데이터)
 */
export const saveProject = async (project: Project) => {
    try {
        const response = await fetch('/api/projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`${errorData.error}${errorData.message ? ': ' + errorData.message : ''}`);
        }
    } catch (error) {
        console.error("Error saving project via API:", error);
        throw error;
    }
};

/**
 * 사용자 본인의 프로젝트 목록 가져오기
 */
export const getUserProjects = async (_userId: string): Promise<UserProject[]> => {
    try {
        const response = await fetch('/api/projects/user');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch user projects');
        }

        const data = await response.json();

        return (data || []).map((p: {
            id: string,
            template_id: string,
            user_id: string,
            name: string,
            scenes: unknown[],
            status?: string,
            created_at: string,
            expires_at: string
        }) => ({
            id: p.id,
            templateId: p.template_id,
            userId: p.user_id,
            projectName: p.name,
            userScenes: p.scenes,
            status: p.status || 'draft',
            created_at: p.created_at,
            expires_at: p.expires_at
        }));
    } catch (error) {
        console.error("Error fetching user projects via API:", error);
        return [];
    }
};

/**
 * 요청 상태 업데이트 및 결과물 등록 (어드민용)
 */
export const updateRequestStatus = async (requestId: string, status: 'pending' | 'processing' | 'completed', resultUrl?: string) => {
    try {
        const response = await fetch('/api/requests/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, status, resultUrl })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update status');
        }
    } catch (error) {
        console.error("Error updating request status via API:", error);
        throw error;
    }
};

/**
 * 모든 템플릿 목록 가져오기
 */
export const getTemplates = async (): Promise<Template[]> => {
    try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch templates');
        }

        const data = await response.json();

        return (data || []).map((t: {
            id: string,
            name: string,
            scene_count?: number,
            scenes: unknown[],
            created_at: string
        }) => ({
            id: t.id,
            name: t.name,
            sceneCount: t.scene_count || t.scenes?.length || 0,
            scenes: t.scenes,
            created_at: t.created_at
        }));
    } catch (error) {
        console.error("Error fetching templates via API:", error);
        return [];
    }
};

/**
 * 템플릿 저장 (어드민용)
 */
export const saveTemplate = async (template: Template) => {
    try {
        const response = await fetch('/api/templates/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save template');
        }
    } catch (error) {
        console.error("Error saving template via API:", error);
        throw error;
    }
};

/**
 * 템플릿 삭제 (어드민용)
 */
export const deleteTemplate = async (id: string) => {
    try {
        const response = await fetch('/api/templates/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete template');
        }
    } catch (error) {
        console.error("Error deleting template via API:", error);
        throw error;
    }
};

/**
 * 프로젝트 삭제
 */
export const deleteProject = async (id: string) => {
    try {
        const response = await fetch('/api/projects/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete project');
        }
    } catch (error) {
        console.error("Error deleting project via API:", error);
        throw error;
    }
};
