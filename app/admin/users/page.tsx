import { createClient } from '@/utils/supabase/server';
import { Search, UserCog, Mail, Phone, Building2, Shield, Loader2 } from 'lucide-react';
import { toggleUserStatus } from './actions';
import UserRoleEditor from './UserRoleEditor';
import UserBranchEditor from './UserBranchEditor';

import { createAdminClient } from '@/utils/supabase/admin';

async function getUsers(query?: string) {
    const supabaseAdmin = createAdminClient();

    // 1. Fetch Profiles (Metadata)
    // Note: This relies on the "Super Admin View All Profiles" RLS policy being active
    // We use admin client here to bypass RLS and ensure we see everything for managing
    let dbQuery = supabaseAdmin
        .from('profiles')
        .select(`
            *,
            organizations ( name ),
            branches ( name )
        `)
        .order('created_at', { ascending: false });

    if (query) {
        dbQuery = dbQuery.or(`email.ilike.%${query}%,full_name.ilike.%${query}%`);
    }

    const { data: profiles, error } = await dbQuery;

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }

    // 2. Fetch Auth Users (Source of Truth for Email)
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000 // Reasonable limit for now
    });

    if (authError) {
        console.error('Error fetching auth users:', authError);
        return profiles || [];
    }

    // 3. Merge Email to ensure we display the Real Login Email
    const mergedUsers = profiles?.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        const realEmail = authUser?.email || profile.email; // Fallback to profile if auth missing (unlikely)

        // Optional: Auto-fix profile if email is missing but exists in auth
        if (authUser && !profile.email && realEmail) {
            // Non-blocking fix in background (fire and forget hope)
            supabaseAdmin.from('profiles').update({ email: realEmail }).eq('id', profile.id).then();
        }

        return {
            ...profile,
            email: realEmail
        };
    });

    return mergedUsers || [];
}

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: { q?: string };
}) {
    const query = searchParams.q || '';
    const users = await getUsers(query);

    return (
        <div className="p-8 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">จัดการผู้ใช้ (User Management)</h1>
                    <p className="text-slate-400 mt-2">รายชื่อผู้ใช้งานทั้งหมดในระบบ ({users.length} คน)</p>
                </div>
            </header>

            {/* Search */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <form className="relative max-w-md">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="ค้นหาชื่อ หรือ Email..."
                        className="w-full bg-slate-800 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-rose-500 focus:border-rose-500"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </form>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">ผู้ใช้งาน (User)</th>
                                <th className="px-6 py-4">บทบาท (Role)</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4">สังกัด (Organization)</th>
                                <th className="px-6 py-4">สาขา (Branch)</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                                <UserCog size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{user.full_name || 'No Name'}</div>
                                                <div className="text-slate-500 text-sm flex items-center gap-1">
                                                    <Mail size={12} /> {user.email}
                                                </div>
                                                {user.phone && (
                                                    <div className="text-slate-500 text-sm flex items-center gap-1">
                                                        <Phone size={12} /> {user.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.is_super_admin ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20">
                                                <Shield size={12} /> SUPER ADMIN
                                            </span>
                                        ) : (
                                            <UserRoleEditor userId={user.id} currentRole={user.role || 'staff'} />
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.is_active !== false ? (
                                            <span className="text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-500/10 rounded-full">
                                                ACTIVE
                                            </span>
                                        ) : (
                                            <span className="text-red-400 text-xs font-bold px-2 py-1 bg-red-500/10 rounded-full">
                                                SUSPENDED
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {(user.organizations as any)?.name ? (
                                            <div className="flex items-center gap-2">
                                                <Building2 size={16} className="text-slate-500" />
                                                {(user.organizations as any)?.name}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic">No Org</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <UserBranchEditor
                                            userId={user.id}
                                            currentBranchId={user.branch_id}
                                            organizationId={user.organization_id}
                                            isOwner={user.role === 'owner'}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!user.is_super_admin && (
                                            <form action={async () => {
                                                'use server';
                                                await toggleUserStatus(user.id, user.is_active !== false);
                                            }}>
                                                <button
                                                    type="submit"
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${user.is_active === false
                                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
                                                        }`}
                                                >
                                                    {user.is_active === false ? 'ปลดบล็อก' : 'ระงับผู้ใช้'}
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
