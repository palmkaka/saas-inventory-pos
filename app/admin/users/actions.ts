'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Helper to check Super Admin
async function checkSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    if (!user) throw new Error('Not authenticated');

    const { data: isSuperAdmin, error } = await supabase.rpc('get_is_super_admin');

    if (error || !isSuperAdmin) {
        throw new Error('Unauthorized');
    }

    return supabase;
}

export async function toggleUserStatus(userId: string, currentStatus: boolean) {
    const supabase = await checkSuperAdmin();

    // Toggle status
    const newStatus = !currentStatus;

    const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', userId);

    if (error) {
        console.error('Error toggling user status:', error);
        return { error: 'Failed to update user status' };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function updateUserRole(userId: string, newRole: string) {
    const supabase = await checkSuperAdmin();

    // Validate role
    const validRoles = ['owner', 'manager', 'accountant', 'staff', 'hr'];
    if (!validRoles.includes(newRole)) {
        return { error: 'Invalid role' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        console.error('Error updating user role:', error);
        return { error: 'Failed to update user role' };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function updateUserBranch(userId: string, branchId: string | null) {
    const supabase = await checkSuperAdmin();

    const { error } = await supabase
        .from('profiles')
        .update({ branch_id: branchId })
        .eq('id', userId);

    if (error) {
        console.error('Error updating user branch:', error);
        return { error: 'Failed to update user branch' };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function fetchOrgBranches(organizationId: string) {
    // Use admin client to ensure we can fetch branches of ANY organization
    // (Super Admin context)
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
        .from('branches')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name');

    if (error) {
        console.error('Error fetching branches:', error);
        return [];
    }

    return data;
}
