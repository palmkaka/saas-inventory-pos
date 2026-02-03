import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import PayrollClient from './PayrollClient';

export default async function PayrollPage() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        redirect('/');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return <PayrollClient initialOrganizationId={null} />;
    }

    let effectiveOrgId = profile.organization_id;

    // Impersonation Logic
    if (profile.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;
        if (impersonatedOrgId) {
            effectiveOrgId = impersonatedOrgId;
        }
    }

    return <PayrollClient initialOrganizationId={effectiveOrgId} />;
}
