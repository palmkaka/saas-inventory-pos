import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ShiftClient from './ShiftClient';

import { cookies } from 'next/headers';

async function getShiftData() {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, is_platform_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { activeShift: null, history: [] };
    }

    let effectiveOrgId = profile.organization_id;
    let effectiveRole = profile.role;

    // Impersonation Logic
    if (profile.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;
        if (impersonatedOrgId) {
            effectiveOrgId = impersonatedOrgId;
            // Treat as manager when impersonating to see all shifts
            effectiveRole = 'manager';
        }
    }

    // Fetch active shift for current user (this might need adjustment if we want to see impersonated user's active shift? 
    // Usually active shift is per user. A super admin impersonating probably doesn't have an active shift in that org.
    // So we keep this as is, showing the Super Admin's invalid shift or null)
    const { data: activeShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

    // Fetch shift history (last 20)
    let query = supabase
        .from('shifts')
        .select(`
            *,
            profiles (full_name, email)
        `)
        .eq('organization_id', effectiveOrgId)
        .order('started_at', { ascending: false })
        .limit(20);

    // If not owner/manager, only see own shifts
    if (effectiveRole !== 'owner' && effectiveRole !== 'manager') {
        query = query.eq('user_id', user.id);
    }

    // If not owner/manager, only see own shifts
    if (profile.role !== 'owner' && profile.role !== 'manager') {
        query = query.eq('user_id', user.id);
    }

    const { data: history } = await query;

    return {
        activeShift: activeShift || null,
        history: history || [],
        userRole: profile.role,
        userId: user.id,
        organizationId: profile.organization_id
    };
}

export default async function ShiftsPage() {
    const data = await getShiftData();

    if ('error' in data) {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการกะการทำงาน (Shift Management)</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            บันทึกเวลาเข้า-ออกงาน และสรุปยอดขายประจำกะ
                        </p>
                    </div>
                </div>
            </header>

            <main className="p-6">
                <ShiftClient
                    initialActiveShift={data.activeShift}
                    initialHistory={data.history}
                    userRole={data.userRole}
                    userId={data.userId || ''}
                    organizationId={data.organizationId || ''}
                />
            </main>
        </div>
    );
}
