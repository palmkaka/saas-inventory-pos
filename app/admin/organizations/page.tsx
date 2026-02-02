import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Search, ShieldAlert, CheckCircle, Ban, Clock, XCircle, Eye } from 'lucide-react';
import { updateOrganizationStatus } from './actions';
import { impersonateOrganization } from '../actions/impersonate';
import { revalidatePath } from 'next/cache';

import OrganizationPlanEditor from './OrganizationPlanEditor';
import DeleteOrganizationButton from './DeleteOrganizationButton';
import ExpiryDateEditor from './ExpiryDateEditor';

async function getOrganizations(query?: string) {
    const supabase = createAdminClient();

    let dbQuery = supabase
        .from('organizations')
        .select('*, subscriptions(expires_at)')
        .order('created_at', { ascending: false });

    if (query) {
        dbQuery = dbQuery.ilike('name', `%${query}%`);
    }

    // Fetch plans concurrently
    const [orgsResult, plansResult] = await Promise.all([
        dbQuery,
        supabase.from('subscription_plans').select('name, display_name').order('sort_order')
    ]);

    if (orgsResult.error) {
        console.error('Error fetching organizations:', orgsResult.error);
        return { orgs: [], plans: [] };
    }

    // Flatten subscriptions data
    const orgs = (orgsResult.data || []).map((org: any) => ({
        ...org,
        expires_at: org.subscriptions?.[0]?.expires_at || null
    }));

    return {
        orgs,
        plans: plansResult.data || []
    };
}

export default async function AdminOrganizationsPage(props: {
    searchParams: Promise<{ q?: string }>;
}) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || '';
    const { orgs, plans } = await getOrganizations(query);

    return (
        <div className="p-8 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">จัดการร้านค้า (Organizations)</h1>
                    <p className="text-slate-400 mt-2">รายชื่อร้านค้าทั้งหมดในระบบ</p>
                </div>
            </header>

            {/* Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <form className="relative max-w-md">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="ค้นหาชื่อร้านค้า..."
                        className="w-full bg-slate-800 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-rose-500 focus:border-rose-500"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </form>
            </div>

            {/* Organizations Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">ชื่อร้านค้า (Organizaton)</th>
                                <th className="px-6 py-4">แพ็กเกจ</th>
                                <th className="px-6 py-4">วันหมดอายุ</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {orgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white text-lg">{org.name}</div>
                                        <div className="text-slate-500 text-sm">
                                            Created: {new Date(org.created_at).toLocaleDateString('th-TH')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <OrganizationPlanEditor
                                            orgId={org.id}
                                            currentPlan={org.subscription_plan || 'free'}
                                            plans={plans}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <ExpiryDateEditor
                                            orgId={org.id}
                                            currentExpiry={org.expires_at}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        {org.status === 'pending' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/20">
                                                <Clock size={12} />
                                                WAITING
                                            </span>
                                        )}
                                        {org.status === 'active' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                                                <CheckCircle size={12} />
                                                ACTIVE
                                            </span>
                                        )}
                                        {org.status === 'suspended' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                                                <Ban size={12} />
                                                SUSPENDED
                                            </span>
                                        )}
                                        {org.status === 'rejected' && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/20">
                                                <XCircle size={12} />
                                                REJECTED
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Approve Button (Only for Pending) */}
                                            {org.status === 'pending' && (
                                                <form action={async () => {
                                                    'use server';
                                                    await updateOrganizationStatus(org.id, 'active');
                                                    revalidatePath('/admin/organizations');
                                                }}>
                                                    <button
                                                        type="submit"
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                                    >
                                                        อนุมัติ (Approve)
                                                    </button>
                                                </form>
                                            )}

                                            {/* Reject Button (Only for Pending) */}
                                            {org.status === 'pending' && (
                                                <form action={async () => {
                                                    'use server';
                                                    await updateOrganizationStatus(org.id, 'rejected');
                                                    revalidatePath('/admin/organizations');
                                                }}>
                                                    <button
                                                        type="submit"
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                                                    >
                                                        ไม่อนุมัติ (Reject)
                                                    </button>
                                                </form>
                                            )}

                                            {/* Block/Unblock Button (For Active/Suspended) */}
                                            {(org.status === 'active' || org.status === 'suspended') && (
                                                <form action={async () => {
                                                    'use server';
                                                    const newStatus = org.status === 'active' ? 'suspended' : 'active';
                                                    await updateOrganizationStatus(org.id, newStatus);
                                                    revalidatePath('/admin/organizations');
                                                }}>
                                                    <button
                                                        type="submit"
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${org.status === 'suspended'
                                                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                                            }`}
                                                    >
                                                        {org.status === 'suspended' ? 'ปลดบล็อก' : 'ระงับการใช้งาน'}
                                                    </button>
                                                </form>
                                            )}
                                            {/* Impersonate Button (Only for Active) */}
                                            {org.status === 'active' && (
                                                <form action={impersonateOrganization.bind(null, org.id)}>
                                                    <button
                                                        type="submit"
                                                        title="เข้าสู่ระบบในนามร้านค้านี้ (Impersonate)"
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors border border-purple-500/20"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </form>
                                            )}

                                            {/* Delete Button */}
                                            <DeleteOrganizationButton orgId={org.id} orgName={org.name} />
                                        </div>
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
