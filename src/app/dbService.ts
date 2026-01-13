import { supabase, type Project } from './supabaseClient'
import type { UserRequest, AdminScene, UserScene, Template } from './types'

export const saveUserRequest = async (request: {
    project_id: string,
    user_id: string,
    type: 'draft' | 'final',
    contact_info: string,
    project_name?: string,
    scenes?: unknown[]
}) => {
    try {
        const { data, error } = await supabase
            .from('requests')
            .insert({
                project_id: request.project_id,
                user_id: request.user_id,
                type: request.type,
                contact_info: request.contact_info,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error("Error saving request to Supabase:", error);
        throw error;
    }
};

export const getAdminRequests = async (): Promise<UserRequest[]> => {
    try {
        // Fetch requests with project details and user profile
        const { data, error } = await supabase
            .from('requests')
            .select(`
                *,
                projects ( name, scenes ),
                profiles ( name, email )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((req: {
            id: string,
            project_id: string,
            projects: { name: string, scenes: (AdminScene | UserScene)[] } | null,
            user_id: string,
            profiles: { name: string | null, email: string | null } | null,
            type: 'draft' | 'final',
            status: 'pending' | 'processing' | 'completed',
            contact_info: string,
            created_at: string
        }) => ({
            id: req.id,
            projectId: req.project_id,
            projectName: req.projects?.name || 'Unknown Project',
            userId: req.user_id,
            userName: req.profiles?.name || req.profiles?.email || 'Unknown User',
            type: req.type,
            status: req.status,
            contactInfo: req.contact_info,
            createdAt: req.created_at,
            userScenes: req.projects?.scenes || []
        }));
    } catch (error) {
        console.error("Error fetching requests from Supabase:", error);
        return [];
    }
};


// Function to save/update a project
export const saveProject = async (project: Project) => {
    try {
        const { error } = await supabase
            .from('projects')
            .upsert(project);

        if (error) throw error;
    } catch (error) {
        console.error("Error saving project:", error);
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
