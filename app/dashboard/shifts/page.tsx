import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ShiftClient from './ShiftClient';

async function getShiftData() {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { activeShift: null, history: [] };
    }

    // Fetch active shift for current user
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
        .eq('organization_id', profile.organization_id)
        .order('started_at', { ascending: false })
        .limit(20);

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
