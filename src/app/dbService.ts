import { supabase, type Project } from './supabaseClient'
import type { UserRequest, Template, UserProject } from './types'

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
            throw new Error(errorData.error || 'Failed to save request');
        }

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error("Error saving request via API:", error);
        throw error;
    }
};

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

export const getUserRequests = async (userId: string): Promise<UserRequest[]> => {
    try {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((req: {
            id: string,
            project_id: string,
            user_id: string,
            type: 'draft' | 'final',
            status: 'pending' | 'processing' | 'completed',
            contact_info: string,
            result_url?: string,
            created_at: string
        }) => ({
            id: req.id,
            projectId: req.project_id,
            projectName: '', // Will be filled if needed or use item link
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
        console.error("Error fetching user requests:", error);
        return [];
    }
};


// Function to save/update a project
export const saveProject = async (project: Project) => {
    try {
        const response = await fetch('/api/projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save project');
        }
    } catch (error) {
        console.error("Error saving project via API:", error);
        throw error;
    }
};

// 사용자 프로젝트 목록 가져오기
export const getUserProjects = async (userId: string): Promise<UserProject[]> => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(p => ({
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
        console.error("Error fetching user projects:", error);
        return [];
    }
};

// 요청 상태 업데이트 및 결과물 등록 (어드민용)
export const updateRequestStatus = async (requestId: string, status: 'pending' | 'processing' | 'completed', resultUrl?: string) => {
    try {
        const { error } = await supabase
            .from('requests')
            .update({ status, result_url: resultUrl })
            .eq('id', requestId);

        if (error) throw error;
    } catch (error) {
        console.error("Error updating request status:", error);
        throw error;
    }
};

/**
 * 모든 템플릿 가져오기 (관리자가 생성한 모든 템플릿을 일반 유저에게 공유)
 */
export const getTemplates = async (): Promise<Template[]> => {
    try {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(t => ({
            id: t.id,
            name: t.name,
            sceneCount: t.scene_count || t.scenes?.length || 0,
            scenes: t.scenes,
            created_at: t.created_at
        }));
    } catch (error) {
        console.error("Error fetching templates from Supabase:", error);
        return [];
    }
};

/**
 * 템플릿 저장 (관리자용)
 */
export const saveTemplate = async (template: Template) => {
    try {
        const { error } = await supabase
            .from('templates')
            .upsert({
                id: template.id,
                name: template.name,
                scene_count: template.scenes.length,
                scenes: template.scenes,
                created_at: template.created_at
            });

        if (error) throw error;
    } catch (error) {
        console.error("Error saving template to Supabase:", error);
        throw error;
    }
};

/**
 * 템플릿 삭제 (관리자용)
 */
export const deleteTemplate = async (id: string) => {
    try {
        const { error } = await supabase
            .from('templates')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error("Error deleting template from Supabase:", error);
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
