import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardLayoutClient from './DashboardLayoutClient';

// Menu items configuration
export const menuItems = [
    { name: 'ภาพรวม', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
    { name: 'ขายสินค้า', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', href: '/dashboard/pos' },
    { name: 'กะการทำงาน', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', href: '/dashboard/shifts' },
    { name: 'ระบบลงเวลา', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', href: '/dashboard/hr/time-attendance' },
    { name: 'เงินเดือน', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', href: '/dashboard/hr/payroll' },
    { name: 'คลังสินค้า', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', href: '/dashboard/inventory' },
    { name: 'ลูกค้า', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', href: '/dashboard/customers' },
    { name: 'รายรับ', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/dashboard/incomes' },
    { name: 'ค่าใช้จ่าย', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', href: '/dashboard/expenses' },
    { name: 'รายงาน', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', href: '/dashboard/reports' },
    { name: 'งบกำไรขาดทุน', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', href: '/dashboard/reports/pnl' },
    { name: 'คอมมิชชั่น', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/dashboard/reports/commission' },
    { name: 'จัดการผู้ใช้งาน', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', href: '/dashboard/settings/users' },
    { name: 'ประวัติการใช้งาน', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/dashboard/settings/audit-logs' },
    { name: 'ตั้งค่า', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', href: '/dashboard/settings' },
];

import { cookies } from 'next/headers';

async function getUserData() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select(`
            organization_id, 
            full_name, 
            role, 
            branch_id, 
            is_active,
            is_platform_admin,
            organizations ( status )
        `)
        .eq('id', user.id)
        .single();



    // Impersonation Logic
    const cookieStore = await cookies();
    const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;


    if (profile?.is_platform_admin && impersonatedOrgId) {
        // Fetch Impersonated Org Status
        const { data: targetOrg, error: targetOrgError } = await supabase
            .from('organizations')
            .select('status')
            .eq('id', impersonatedOrgId)
            .single();



        // Valid Org? Override.
        if (targetOrg) {

            return {
                user,
                profile: {
                    ...profile,
                    organization_id: impersonatedOrgId,
                    role: 'owner',
                    branch_id: null,
                    is_platform_admin: true, // Explicitly preserve admin flag
                    organizations: { status: targetOrg.status }
                },
                branchName: 'Impersonating'
            };
        }
    }

    let branchName = '';
    if (profile?.branch_id) {
        const { data: branch } = await supabase
            .from('branches')
            .select('name')
            .eq('id', profile.branch_id)
            .single();
        if (branch) branchName = branch.name;
    }

    return { user, profile, branchName };
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const userData = await getUserData();

    if (!userData) {
        redirect('/');
    }

    // 1. Check if user is individually suspended
    if (userData.profile?.is_active === false) {
        redirect('/suspended');
    }

    // 2. Check if organization is suspended/pending (Skip for Super Admins)

    if (!userData.profile?.is_platform_admin) {
        const orgStatus = (userData.profile?.organizations as any)?.status;
        if (orgStatus === 'suspended' || orgStatus === 'rejected' || orgStatus === 'pending') {
            // You might want a specific page for Org Suspended vs User Suspended, 
            // but /pending-approval or /suspended works for now.
            // Let's use /pending-approval for now as per previous implementation logic.
            redirect('/pending-approval');
        }
    }

    const { user, profile, branchName } = userData;

    return (
        <DashboardLayoutClient
            menuItems={menuItems}
            user={{ email: user.email || '' }}
            profile={{
                full_name: profile?.full_name || 'User',
                role: profile?.role || 'staff',
                branch_name: branchName
            }}
            isImpersonating={branchName === 'Impersonating'}
        >
            {children}
        </DashboardLayoutClient>
    );
}
