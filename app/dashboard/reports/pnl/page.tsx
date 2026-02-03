import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface MonthlyData {
    revenue: number;
    cost: number;
    sellingExpenses: number;
    adminExpenses: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
}

const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

import { cookies } from 'next/headers';

async function getPnLData(year: number) {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { data: null, organizationId: null, year };
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

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Fetch orders (revenue)
    const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('organization_id', effectiveOrgId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    // Fetch expenses with category join
    const { data: expenses } = await supabase
        .from('expenses')
        .select(`
            amount,
            expense_date,
            expense_categories (
                group_type
            )
        `)
        .eq('organization_id', effectiveOrgId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

    // Initialize monthly data
    const monthlyData: MonthlyData[] = Array.from({ length: 12 }, () => ({
        revenue: 0,
        cost: 0,
        sellingExpenses: 0,
        adminExpenses: 0,
        grossProfit: 0,
        totalExpenses: 0,
        netProfit: 0,
    }));

    // Process orders
    (orders || []).forEach((order) => {
        const month = new Date(order.created_at).getMonth();
        monthlyData[month].revenue += parseFloat(order.total_amount) || 0;
    });

    // Process expenses - get group_type from joined expense_categories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expenses || []).forEach((expense: any) => {
        const month = new Date(expense.expense_date).getMonth();
        const amount = parseFloat(String(expense.amount)) || 0;

        // Get group_type from joined category
        const groupType = Array.isArray(expense.expense_categories)
            ? expense.expense_categories[0]?.group_type
            : expense.expense_categories?.group_type;

        switch (groupType) {
            case 'COST':
                monthlyData[month].cost += amount;
                break;
            case 'SELLING':
                monthlyData[month].sellingExpenses += amount;
                break;
            case 'ADMIN':
                monthlyData[month].adminExpenses += amount;
                break;
        }
    });

    // Calculate derived values
    monthlyData.forEach((month) => {
        month.grossProfit = month.revenue - month.cost;
        month.totalExpenses = month.sellingExpenses + month.adminExpenses;
        month.netProfit = month.grossProfit - month.totalExpenses;
    });

    // Calculate totals
    const totals: MonthlyData = {
        revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
        cost: monthlyData.reduce((sum, m) => sum + m.cost, 0),
        sellingExpenses: monthlyData.reduce((sum, m) => sum + m.sellingExpenses, 0),
        adminExpenses: monthlyData.reduce((sum, m) => sum + m.adminExpenses, 0),
        grossProfit: 0,
        totalExpenses: 0,
        netProfit: 0,
    };
    totals.grossProfit = totals.revenue - totals.cost;
    totals.totalExpenses = totals.sellingExpenses + totals.adminExpenses;
    totals.netProfit = totals.grossProfit - totals.totalExpenses;

    return { data: { monthly: monthlyData, totals }, organizationId: profile.organization_id, year };
}

export default async function PnLReportPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string }>;
}) {
    const params = await searchParams;
    const year = parseInt(params.year || '') || new Date().getFullYear();
    const result = await getPnLData(year);

    if ('error' in result) {
        redirect('/');
    }

    const { data, organizationId } = result;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const rows = [
        { key: 'revenue', label: 'รายได้', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { key: 'cost', label: 'ต้นทุนขาย', color: 'text-red-400', bg: 'bg-red-500/10' },
        { key: 'grossProfit', label: 'กำไรขั้นต้น', color: 'text-blue-400', bg: 'bg-blue-500/10', bold: true },
        { key: 'sellingExpenses', label: 'ค่าใช้จ่ายการขาย', color: 'text-orange-400', bg: '' },
        { key: 'adminExpenses', label: 'ค่าใช้จ่ายบริหาร', color: 'text-yellow-400', bg: '' },
        { key: 'totalExpenses', label: 'รวมค่าใช้จ่าย', color: 'text-red-300', bg: '' },
        { key: 'netProfit', label: 'กำไรสุทธิ', color: 'text-emerald-400', bg: 'bg-emerald-500/10', bold: true },
    ];

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 lg:px-6 py-4 sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/reports"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">งบกำไรขาดทุน</h1>
                            <p className="text-slate-400 text-xs md:text-sm mt-0.5">ปี {year}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 self-start md:self-auto w-full md:w-auto">
                        <Link
                            href={`/dashboard/reports/pnl?year=${year - 1}`}
                            className="flex-1 md:flex-none px-3 py-1.5 text-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors text-sm"
                        >
                            ← {year - 1}
                        </Link>
                        <span className="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-md font-semibold text-sm min-w-[80px] text-center">
                            {year}
                        </span>
                        <Link
                            href={`/dashboard/reports/pnl?year=${year + 1}`}
                            className="flex-1 md:flex-none px-3 py-1.5 text-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors text-sm"
                        >
                            {year + 1} →
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6">
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <p className="text-yellow-400">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800 border-b border-slate-700/50">
                                        <th className="text-left px-4 py-3 text-slate-400 font-medium sticky left-0 bg-slate-800 z-10 min-w-[200px]">
                                            รายการ
                                        </th>
                                        {monthNames.map((month, i) => (
                                            <th key={i} className="text-right px-3 py-3 text-slate-400 font-medium min-w-[90px]">
                                                {month}
                                            </th>
                                        ))}
                                        <th className="text-right px-4 py-3 text-white font-bold bg-slate-700/50 min-w-[100px]">
                                            รวม
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${row.bg}`}
                                        >
                                            <td className={`px-4 py-3 sticky left-0 bg-slate-800/90 z-10 ${row.bold ? 'font-bold' : ''} ${row.color}`}>
                                                {row.label}
                                            </td>
                                            {data?.monthly.map((month, i) => {
                                                const value = month[row.key as keyof MonthlyData];
                                                const isNegative = value < 0;
                                                return (
                                                    <td
                                                        key={i}
                                                        className={`text-right px-3 py-3 ${row.bold ? 'font-bold' : ''} ${isNegative ? 'text-red-400' : row.color
                                                            }`}
                                                    >
                                                        {value !== 0 ? formatCurrency(value) : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td
                                                className={`text-right px-4 py-3 bg-slate-700/30 font-bold ${(data?.totals[row.key as keyof MonthlyData] || 0) < 0 ? 'text-red-400' : row.color
                                                    }`}
                                            >
                                                {formatCurrency(data?.totals[row.key as keyof MonthlyData] || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">
                                * ข้อมูลคำนวณจากยอดขายและค่าใช้จ่ายที่บันทึกในระบบ
                            </p>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                            <p className="text-slate-400 text-sm font-medium">รายได้รวม</p>
                            <p className="text-2xl font-bold text-emerald-400 mt-1">฿{formatCurrency(data.totals.revenue)}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                            <p className="text-slate-400 text-sm font-medium">กำไรขั้นต้น</p>
                            <p className="text-2xl font-bold text-blue-400 mt-1">฿{formatCurrency(data.totals.grossProfit)}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                            <p className="text-slate-400 text-sm font-medium">ค่าใช้จ่ายรวม</p>
                            <p className="text-2xl font-bold text-red-400 mt-1">฿{formatCurrency(data.totals.cost + data.totals.totalExpenses)}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                            <p className="text-slate-400 text-sm font-medium">กำไรสุทธิ</p>
                            <p className={`text-2xl font-bold mt-1 ${data.totals.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                ฿{formatCurrency(data.totals.netProfit)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
