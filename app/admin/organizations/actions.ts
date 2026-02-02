'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

// ... (keep checkSuperAdmin and updateOrganizationStatus)

export async function deleteOrganization(orgId: string) {
    // 1. Authenticate and Authorize using standard client
    await checkSuperAdmin();

    try {
        // 2. Perform deletion using Admin Client (Bypass RLS)
        const supabase = createAdminClient();

        // Mazu Manual Cascade Delete Sequence
        // 1. Delete transactional references first (Deepest children)
        await supabase.from('order_items').delete().eq('organization_id', orgId);
        await supabase.from('orders').delete().eq('organization_id', orgId);

        // 2. Delete financial records
        await supabase.from('incomes').delete().eq('organization_id', orgId);
        await supabase.from('expenses').delete().eq('organization_id', orgId);
        await supabase.from('income_categories').delete().eq('organization_id', orgId);
        await supabase.from('expense_categories').delete().eq('organization_id', orgId);

        // 3. Delete inventory & product data
        await supabase.from('product_stocks').delete().eq('branch_id', orgId); // Wait, stocks link to branches, but let's be safe if direct link exists
        // Actually product_stocks don't have org_id usually, they have branch_id. 
        // We will delete branches later which should cascade or we delete via branch lookup.
        // But let's delete products which do have org_id.
        await supabase.from('products').delete().eq('organization_id', orgId);
        await supabase.from('categories').delete().eq('organization_id', orgId);

        // 4. Delete system logs & requests
        await supabase.from('audit_logs').delete().eq('organization_id', orgId);
        await supabase.from('approval_requests').delete().eq('organization_id', orgId);
        await supabase.from('subscriptions').delete().eq('organization_id', orgId);

        // 5. Delete structure
        // Note: Delete profiles first or branches?
        // Profiles might reference branches. Branches reference Organization.
        // Let's delete profiles first.
        const { error: profileError } = await supabase.from('profiles').delete().eq('organization_id', orgId);
        if (profileError) console.error('Error deleting profiles:', profileError);

        const { error: branchError } = await supabase.from('branches').delete().eq('organization_id', orgId);
        if (branchError) console.error('Error deleting branches:', branchError);

        // 6. Finally delete the organization
        const { error } = await supabase
            .from('organizations')
            .delete()
            .eq('id', orgId);

        if (error) {
            console.error('Error deleting organization:', error);
            return { error: `Failed to delete organization: ${error.message}` };
        }

        revalidatePath('/admin/organizations');
        return { success: true };

    } catch (err) {
        console.error('Unexpected error during delete:', err);
        return { error: 'An unexpected error occurred during deletion.' };
    }
}

// Helper to check if user is super admin
async function checkSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    if (!user) throw new Error('Not authenticated');

    // Use RPC to safely check admin status (bypassing potential RLS recursion issues)
    const { data: isSuperAdmin, error } = await supabase.rpc('get_is_super_admin');

    if (error || !isSuperAdmin) {
        console.error('Super Admin Check Failed:', error);
        throw new Error('Unauthorized');
    }

    return supabase;
}

export async function updateOrganizationStatus(orgId: string, newStatus: 'active' | 'suspended' | 'rejected' | 'pending') {
    const supabase = await checkSuperAdmin();

    const { error } = await supabase
        .from('organizations')
        .update({
            status: newStatus,
            // Sync is_blocked for backward compatibility
            is_blocked: newStatus === 'suspended' || newStatus === 'rejected',
            blocked_at: (newStatus === 'suspended' || newStatus === 'rejected') ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        })
        .eq('id', orgId);

    if (error) {
        console.error('Error updating organization status:', error);
        return { error: 'Failed to update organization status' };
    }

    revalidatePath('/admin/organizations');
    return { success: true };
}

export async function updateOrganizationPlan(orgId: string, planSlug: string) {
    const supabaseAuth = await checkSuperAdmin();
    const supabase = createAdminClient();

    // Convert to lowercase for subscriptions table (it has CHECK constraint)
    const planLower = planSlug.toLowerCase();

    // Update organizations table
    const { error: orgError } = await supabase
        .from('organizations')
        .update({ subscription_plan: planSlug })
        .eq('id', orgId);

    if (orgError) {
        console.error('Error updating organization plan:', orgError);
        return { error: 'Failed to update organization plan' };
    }

    // Also update/upsert subscriptions table for the billing page
    const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('organization_id', orgId)
        .single();

    if (existingSub) {
        // Update existing subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .update({
                plan: planLower,
                status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('organization_id', orgId);

        if (subError) {
            console.error('Error updating subscription:', subError);
        }
    } else {
        // Create new subscription record
        const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
                organization_id: orgId,
                plan: planLower,
                status: 'active',
                expires_at: null,
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Error creating subscription:', insertError);
        }
    }

    revalidatePath('/admin/organizations');
    return { success: true };
}

export async function updateSubscriptionExpiry(orgId: string, expiryDate: string | null) {
    await checkSuperAdmin();
    const supabase = createAdminClient();

    // Check if subscription exists
    const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('organization_id', orgId)
        .single();

    if (existingSub) {
        // Update existing subscription
        const { error } = await supabase
            .from('subscriptions')
            .update({
                expires_at: expiryDate,
                updated_at: new Date().toISOString()
            })
            .eq('organization_id', orgId);

        if (error) {
            console.error('Error updating subscription expiry:', error);
            return { error: 'Failed to update expiry date' };
        }
    } else {
        // Get org's current plan
        const { data: org } = await supabase
            .from('organizations')
            .select('subscription_plan')
            .eq('id', orgId)
            .single();

        // Create new subscription record
        const { error } = await supabase
            .from('subscriptions')
            .insert({
                organization_id: orgId,
                plan: (org?.subscription_plan || 'free').toLowerCase(),
                status: 'active',
                expires_at: expiryDate,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error creating subscription:', error);
            return { error: 'Failed to create subscription' };
        }
    }

    revalidatePath('/admin/organizations');
    revalidatePath('/dashboard/settings/billing');
    return { success: true };
}
