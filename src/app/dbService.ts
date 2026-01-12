import { supabase, type Project } from './supabaseClient'
import type { UserRequest, AdminScene, UserScene } from './types'

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
