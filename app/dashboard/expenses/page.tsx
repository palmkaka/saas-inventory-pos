import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeleteExpenseButton } from './ExpenseClient';
import { cookies } from 'next/headers';

interface Expense {
    id: string;
    category_id: string | null;
    title: string;
    amount: number;
    recipient_name: string | null;
    expense_date: string;
    category_name: string | null;
    group_type: string | null;
}

const groupLabels: Record<string, string> = {
    COST: 'ต้นทุนขาย',
    SELLING: 'ค่าใช้จ่ายการขาย',
    ADMIN: 'ค่าใช้จ่ายบริหาร',
};

async function getExpenses() {
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
        return { expenses: [], organizationId: null };
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

    // Fetch expenses with category join
    const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
            id,
            category_id,
            title,
            amount,
            recipient_name,
            expense_date,
            expense_categories (
                name,
                group_type
            )
        `)
        .eq('organization_id', effectiveOrgId)
        .order('expense_date', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching expenses:', error);
        return { expenses: [], organizationId: effectiveOrgId };
    }

    // Transform data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedExpenses: Expense[] = (expenses || []).map((e: any) => {
        const category = Array.isArray(e.expense_categories)
            ? e.expense_categories[0]
            : e.expense_categories;
        return {
            id: e.id,
            category_id: e.category_id || null,
            title: e.title || '',
            amount: e.amount || 0,
            recipient_name: e.recipient_name || null,
            expense_date: e.expense_date || new Date().toISOString().split('T')[0],
            category_name: category?.name || null,
            group_type: category?.group_type || null,
        };
    });

    return { expenses: transformedExpenses, organizationId: effectiveOrgId };
}

export default async function ExpensesPage() {
    const result = await getExpenses();

    if ('error' in result) {
        redirect('/');
    }

    const { expenses, organizationId } = result;

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

    // Calculate totals by group
    const totalByGroup = expenses.reduce((acc, exp) => {
        const group = exp.group_type || 'OTHER';
        acc[group] = (acc[group] || 0) + (exp.amount || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">รายจ่าย</h1>
                        <p className="text-slate-400 text-sm mt-1">จัดการค่าใช้จ่ายของธุรกิจ</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/settings/expenses"
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            จัดการหมวดหมู่
                        </Link>
                        <Link
                            href="/dashboard/expenses/new"
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มรายจ่าย
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">ต้นทุนขาย</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(totalByGroup.COST || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">ค่าใช้จ่ายการขาย</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(totalByGroup.SELLING || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">ค่าใช้จ่ายบริหาร</p>
                        <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(totalByGroup.ADMIN || 0)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">รวมทั้งหมด</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {formatCurrency((Object.values(totalByGroup) as number[]).reduce((a, b) => a + b, 0))}
                        </p>
                    </div>
                </div>

                {/* Expenses Table */}
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <p className="text-yellow-400">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-white mb-2">ยังไม่มีรายจ่าย</h2>
                        <p className="text-slate-400 mb-6">เริ่มบันทึกค่าใช้จ่ายของธุรกิจ</p>
                        <Link
                            href="/dashboard/expenses/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl"
                        >
                            เพิ่มรายจ่ายรายการแรก
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">วันที่</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">กลุ่ม</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">หมวดหมู่</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">รายละเอียด</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">ผู้รับเงิน</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400 uppercase">จำนวน</th>
                                    <th className="text-center px-6 py-4 text-sm font-medium text-slate-400 uppercase">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {expenses.map((expense: Expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300">{formatDate(expense.expense_date)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${expense.group_type === 'COST' ? 'bg-red-500/20 text-red-400' :
                                                expense.group_type === 'SELLING' ? 'bg-orange-500/20 text-orange-400' :
                                                    expense.group_type === 'ADMIN' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {groupLabels[expense.group_type || ''] || expense.group_type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300">
                                                {expense.category_name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white">{expense.title}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-400">{expense.recipient_name || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white font-medium">{formatCurrency(expense.amount)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DeleteExpenseButton expenseId={expense.id} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">แสดง {expenses.length} รายการ</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
