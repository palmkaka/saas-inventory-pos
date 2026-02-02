'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function impersonateOrganization(orgId: string) {

    const supabase = await createClient();

    // Security Check: Only Super Admins can impersonate
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: isSuperAdmin } = await supabase.rpc('get_is_super_admin');
    if (!isSuperAdmin) throw new Error('Unauthorized');

    // Set Cookie (Delete old one first to be safe)
    const cookieStore = await cookies();
    cookieStore.delete('x-impersonate-org-id-v2'); // Use new name
    cookieStore.set('x-impersonate-org-id-v2', orgId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    revalidatePath('/dashboard');
    redirect('/dashboard');
}

export async function stopImpersonating() {
    (await cookies()).delete('x-impersonate-org-id-v2');
    redirect('/admin/organizations');
}
