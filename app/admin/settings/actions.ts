'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

// Helper to check Super Admin
async function checkSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data: isSuperAdmin, error } = await supabase.rpc('get_is_super_admin');

    if (error || !isSuperAdmin) {
        throw new Error('Unauthorized');
    }

    return supabase;
}

export async function createSubscriptionPlan(formData: FormData) {
    const supabase = await checkSuperAdmin();

    const name = formData.get('name') as string;
    const displayName = formData.get('display_name') as string;
    const price = parseFloat(formData.get('price') as string);
    const billingPeriod = formData.get('billing_period') as string;
    const maxProducts = parseInt(formData.get('max_products') as string);
    const maxBranches = parseInt(formData.get('max_branches') as string);
    const maxEmployees = parseInt(formData.get('max_employees') as string);

    if (!name || !displayName) {
        return { error: 'Name and Display Name are required' };
    }

    const { error } = await supabase
        .from('subscription_plans')
        .insert({
            name,
            display_name: displayName,
            price,
            billing_period: billingPeriod,
            max_products: maxProducts,
            max_branches: maxBranches,
            max_employees: maxEmployees,
            sort_order: 99,
            features: { pos: true, reports: true }
        });

    if (error) {
        console.error('Error creating plan:', error);
        return { error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
}

export async function updateSubscriptionPlan(planId: string, formData: FormData) {
    const supabase = await checkSuperAdmin();

    const displayName = formData.get('display_name') as string;
    const price = parseFloat(formData.get('price') as string);
    const billingPeriod = formData.get('billing_period') as string;
    const maxProducts = parseInt(formData.get('max_products') as string);
    const maxBranches = parseInt(formData.get('max_branches') as string);
    const maxEmployees = parseInt(formData.get('max_employees') as string);

    const { error } = await supabase
        .from('subscription_plans')
        .update({
            display_name: displayName,
            price,
            billing_period: billingPeriod,
            max_products: maxProducts,
            max_branches: maxBranches,
            max_employees: maxEmployees,
        })
        .eq('id', planId);

    if (error) {
        console.error('Error updating plan:', error);
        return { error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
}

export async function deleteSubscriptionPlan(planId: string) {
    const supabase = await checkSuperAdmin();

    const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

    if (error) {
        console.error('Error deleting plan:', error);
        return { error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
}

// System Settings Actions
export async function getSystemSettings() {
    const supabase = await createClient();
    // Public read access is allowed by policy, but good to check auth if needed.
    // However, settings like 'maintenance_mode' need to be read publicly.
    // For Admin page, we might want to ensure we're fetching fresh data.

    // Using simple fetch, policies will handle access.
    // For editing in Admin panel, RLS will enforce update rights.

    const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*');

    if (error) {
        console.error('Error fetching system settings:', error);
        return {};
    }

    // Convert to object for easier usage: { maintenance_mode: 'false', ... }
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
        settingsMap[s.key] = s.value;
    });

    return settingsMap;
}

export async function updateSystemSetting(key: string, value: string) {
    // 1. Verify permission
    await checkSuperAdmin();

    // 2. Use Admin Client to bypass RLS for the update (ensures it writes if key exists)
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('system_settings')
        .update({
            value,
            updated_at: new Date().toISOString()
            // We could set updated_by if we fetched the user ID, but it's optional for now
        })
        .eq('key', key);

    if (error) {
        console.error(`Error updating setting ${key}:`, error);
        return { error: error.message };
    }

    revalidatePath('/admin/settings');
    revalidatePath('/login');
    revalidatePath('/'); // Root Login Page
    revalidatePath('/signup');
    return { success: true };
}
