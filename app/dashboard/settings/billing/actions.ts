'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitPayment(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const organizationId = formData.get('organizationId') as string;
    const amount = Number(formData.get('amount'));
    const slipUrl = formData.get('slipUrl') as string;
    const type = formData.get('type') as string || 'transfer';
    const notes = formData.get('notes') as string || '';

    if (!organizationId || !amount || !slipUrl) {
        return { error: 'Missing required fields' };
    }

    // Insert transaction
    const { error } = await supabase.from('payment_transactions').insert({
        organization_id: organizationId,
        amount,
        slip_url: slipUrl,
        type,
        notes,
        status: 'pending',
        payment_date: new Date().toISOString()
    });

    if (error) {
        console.error('Error submitting payment:', error);
        return { error: 'Failed to submit payment' };
    }

    revalidatePath('/dashboard/settings/billing');
    return { success: true };
}

// New action to fetch billing info bypassing RLS
import { createAdminClient } from '@/utils/supabase/admin';
import { cookies } from 'next/headers';

export async function getBillingInfo() {
    const supabase = await createClient(); // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    // Get Org ID
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return { error: 'Organization not found' };

    let effectiveOrgId = profile.organization_id;

    // Impersonation Logic
    if (profile.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;
        if (impersonatedOrgId) {
            effectiveOrgId = impersonatedOrgId;
        }
    }

    // Use Admin Client to fetch subscription data (bypassing RLS)
    const adminClient = createAdminClient();

    // Get Organization info
    const { data: org } = await adminClient
        .from('organizations')
        .select('subscription_plan, status')
        .eq('id', effectiveOrgId)
        .single();

    // Get subscription record
    const { data: sub } = await adminClient
        .from('subscriptions')
        .select('*')
        .eq('organization_id', effectiveOrgId)
        .maybeSingle();

    // Get Transactions
    const { data: txs } = await adminClient
        .from('payment_transactions')
        .select('*')
        .eq('organization_id', effectiveOrgId)
        .order('payment_date', { ascending: false });

    // Construct simplified subscription object
    const subscription = sub ? sub : {
        plan: org?.subscription_plan || 'free',
        status: org?.status === 'active' ? 'active' : 'suspended',
        expires_at: null
    };

    return {
        subscription,
        transactions: txs || [],
        organizationId: effectiveOrgId
    };
}
