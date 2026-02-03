import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import UserManagementClient from './UserManagementClient';

interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: string;
}

import { cookies } from 'next/headers';

async function getUsers() {
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
        return { users: [], currentUserRole: null, organizationId: '', branches: [] };
    }

    // เฉพาะ Owner และ HR หรือ Platform Admin เท่านั้นที่เข้าหน้านี้ได้
    if (profile.role !== 'owner' && profile.role !== 'hr' && !profile.is_platform_admin) {
        return { error: 'Unauthorized' };
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

    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .eq('organization_id', effectiveOrgId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return { users: [], currentUserRole: profile.role };
    }

    const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .eq('organization_id', effectiveOrgId)
        .order('name');

    return {
        users: users || [],
        currentUserRole: profile.role,
        organizationId: effectiveOrgId,
        branches: branches || []
    };
}

export default async function UserManagementPage() {
    const data = await getUsers();

    if ('error' in data) {
        if (data.error === 'Not authenticated') {
            redirect('/');
        }
        if (data.error === 'Unauthorized') {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
                        <h2 className="text-xl font-bold text-red-400 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                        <p className="text-slate-300">เฉพาะ Owner และ HR เท่านั้นที่สามารถจัดการผู้ใช้งานได้</p>
                    </div>
                </div>
            );
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { users, currentUserRole, organizationId, branches } = data as any;

    return (
        <div className="min-h-screen bg-slate-900">
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการผู้ใช้งาน</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            จัดการสิทธิ์และบทบาทของพนักงานในองค์กร
                        </p>
                    </div>
                </div>
            </header>

            <main className="p-6">
                <UserManagementClient
                    users={users || []}
                    currentUserRole={currentUserRole}
                    organizationId={organizationId}
                    branches={branches}
                />
            </main>
        </div>
    );
}
