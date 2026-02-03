import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeleteIncomeButton } from './IncomesClient';
import { cookies } from 'next/headers';

interface Income {
    id: string;
    category_id: string | null;
    title: string;
    amount: number;
    payer_name: string | null;
    income_date: string;
    category_name: string | null;
    income_type: string | null;
}

const typeLabels: Record<string, string> = {
    SALES: 'รายได้จากการขาย',
    SERVICE: 'รายได้จากบริการ',
    OTHER: 'รายได้อื่นๆ',
};

async function getIncomes() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { incomes: [], organizationId: null };
    }

    // Impersonation Logic
    let effectiveOrgId = profile.organization_id;
    if (profile.is_platform_admin) {
        const cookieStore = await cookies();
        const impersonatedOrgId = cookieStore.get('x-impersonate-org-id-v2')?.value;
        if (impersonatedOrgId) {
            effectiveOrgId = impersonatedOrgId;
        }
    }

    // Fetch incomes with category join
    const { data: incomes, error } = await supabase
        .from('incomes')
        .select(`
            id,
            category_id,
            title,
            amount,
            payer_name,
            income_date,
            income_categories (
                name,
                income_type
            )
        `)
        .eq('organization_id', effectiveOrgId)
        .order('income_date', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching incomes:', error);
        return { incomes: [], organizationId: effectiveOrgId };
    }

    // Transform data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedIncomes: Income[] = (incomes || []).map((e: any) => {
        const category = Array.isArray(e.income_categories)
            ? e.income_categories[0]
            : e.income_categories;
        return {
            id: e.id,
            category_id: e.category_id || null,
            title: e.title || '',
            amount: e.amount || 0,
            payer_name: e.payer_name || null,
            income_date: e.income_date || new Date().toISOString().split('T')[0],
            category_name: category?.name || null,
            income_type: category?.income_type || null,
        };
    });

    return { incomes: transformedIncomes, organizationId: effectiveOrgId };
}

export default async function IncomesPage() {
    const result = await getIncomes();

    if ('error' in result) {
        redirect('/');
    }

    const { incomes, organizationId } = result;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Calculate totals by type
    const totalByType = incomes.reduce((acc, inc) => {
        const type = inc.income_type || 'OTHER';
        acc[type] = (acc[type] || 0) + (inc.amount || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">รายรับ</h1>
                        <p className="text-slate-400 text-sm mt-1">บันทึกรายได้ของธุรกิจ</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/settings/incomes"
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            จัดการหมวดหมู่
                        </Link>
                        <Link
                            href="/dashboard/incomes/new"
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มรายรับ
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">รายได้จากการขาย</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalByType.SALES || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">รายได้จากบริการ</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(totalByType.SERVICE || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">รายได้อื่นๆ</p>
                        <p className="text-2xl font-bold text-purple-400 mt-1">{formatCurrency(totalByType.OTHER || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">รวมทั้งหมด</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {formatCurrency((Object.values(totalByType) as number[]).reduce((a, b) => a + b, 0))}
                        </p>
                    </div>
                </div>

                {/* Incomes Table */}
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <p className="text-yellow-400">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                    </div>
                ) : incomes.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-white mb-2">ยังไม่มีรายรับ</h2>
                        <p className="text-slate-400 mb-6">เริ่มบันทึกรายได้ของธุรกิจ</p>
                        <Link
                            href="/dashboard/incomes/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl"
                        >
                            เพิ่มรายรับรายการแรก
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">วันที่</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">ประเภท</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">หมวดหมู่</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">รายละเอียด</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">ผู้จ่าย</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400 uppercase">จำนวน</th>
                                    <th className="text-center px-6 py-4 text-sm font-medium text-slate-400 uppercase">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {incomes.map((income: Income) => (
                                    <tr key={income.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300">{formatDate(income.income_date)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${income.income_type === 'SALES' ? 'bg-emerald-500/20 text-emerald-400' :
                                                income.income_type === 'SERVICE' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                {typeLabels[income.income_type || ''] || income.income_type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300">
                                                {income.category_name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white">{income.title}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-400">{income.payer_name || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-emerald-400 font-medium">{formatCurrency(income.amount)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DeleteIncomeButton
                                                incomeId={income.id}
                                                onDelete={async (id) => {
                                                    'use server';
                                                    const supabase = await createClient();
                                                    await supabase.from('incomes').delete().eq('id', id);
                                                    redirect('/dashboard/incomes');
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">แสดง {incomes.length} รายการ</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
