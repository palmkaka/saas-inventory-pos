'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function verifyPayment(
    transactionId: string,
    status: 'approved' | 'rejected',
    notes?: string,
    expiryDate?: string // New: Admin-specified expiry date
) {
    // 1. Check if user is Super Admin
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: isSuperAdmin } = await supabaseAuth.rpc('get_is_super_admin');
    if (!isSuperAdmin) throw new Error('Unauthorized');

    // 2. Use Admin Client to perform updates
    const supabase = createAdminClient();

    try {
        // Get transaction details
        const { data: tx, error: txError } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (txError || !tx) throw new Error('Transaction not found');

        // Update Transaction Status
        const { error: updateError } = await supabase
            .from('payment_transactions')
            .update({
                status,
                notes,
                verified_at: new Date().toISOString(),
                verified_by: user.id
            })
            .eq('id', transactionId);

        if (updateError) throw updateError;

        // If Approved -> Extend Subscription & Activate Org
        if (status === 'approved') {
            await handleSubscriptionExtension(supabase, tx.organization_id, expiryDate);
        }

        revalidatePath('/admin/payments');
        return { success: true };

    } catch (err) {
        console.error('Error verifying payment:', err);
        return { error: 'Failed to verify payment' };
    }
}

async function handleSubscriptionExtension(supabase: any, orgId: string, expiryDate?: string) {
    // 1. Get current subscription
    const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .single();

    // 2. Activate Organization (if suspended)
    await supabase
        .from('organizations')
        .update({ status: 'active', is_blocked: false })
        .eq('id', orgId);

    // 3. Determine Expiry Date
    let newExpiry: Date;

    if (expiryDate) {
        // Use Admin-specified date
        newExpiry = new Date(expiryDate);
    } else {
        // Auto-calculate: If expires_at is in future, add 30 days to it. Otherwise, now + 30 days.
        const now = new Date();
        newExpiry = new Date();

        if (sub?.expires_at && new Date(sub.expires_at) > now) {
            newExpiry = new Date(sub.expires_at);
        }

        newExpiry.setDate(newExpiry.getDate() + 30);
    }

    if (sub) {
        await supabase
            .from('subscriptions')
            .update({
                expires_at: newExpiry.toISOString(),
                status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('organization_id', orgId);
    } else {
        // Create new subscription if missing (fallback)
        await supabase
            .from('subscriptions')
            .insert({
                organization_id: orgId,
                plan: 'pro', // Default to Pro if unknown
                status: 'active',
                expires_at: newExpiry.toISOString(),
                created_at: new Date().toISOString()
            });
    }
}

