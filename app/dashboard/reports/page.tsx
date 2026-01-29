import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    seller_name: string | null;
}

async function getReportsData() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { orders: [], organizationId: null };
    }

    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
      id,
      total_amount,
      status,
      created_at,
      profiles (full_name)
    `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching orders:', error);
        return { orders: [], organizationId: profile.organization_id };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedOrders: Order[] = (orders || []).map((o: any) => ({
        id: o.id,
        total_amount: o.total_amount,
        status: o.status,
        created_at: o.created_at,
        seller_name: Array.isArray(o.profiles)
            ? o.profiles[0]?.full_name || null
            : o.profiles?.full_name || null,
    }));

    return { orders: transformedOrders, organizationId: profile.organization_id };
}

export default async function ReportsPage() {
    const result = await getReportsData();

    if ('error' in result) {
        redirect('/');
    }

    const { orders, organizationId } = result;

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
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalSales = orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0);
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">รายงานยอดขาย</h1>
                        <p className="text-slate-400 text-sm mt-1">ดูประวัติการขายและสถิติ</p>
                    </div>
                    <Link
                        href="/dashboard/reports/pnl"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        ดูงบกำไรขาดทุน
                    </Link>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">ยอดขายรวม</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalSales)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">จำนวนออเดอร์ทั้งหมด</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{orders.length} รายการ</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <p className="text-slate-400 text-sm font-medium">ออเดอร์สำเร็จ</p>
                        <p className="text-2xl font-bold text-white mt-1">{completedOrders} รายการ</p>
                    </div>
                </div>

                {/* Orders Table */}
                {!organizationId ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <p className="text-yellow-400">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-white mb-2">ยังไม่มียอดขาย</h2>
                        <p className="text-slate-400 mb-6">เริ่มขายสินค้าเพื่อดูรายงาน</p>
                        <Link
                            href="/dashboard/pos"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl"
                        >
                            ไปหน้าขายสินค้า
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">รหัสออเดอร์</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">วันที่/เวลา</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 uppercase">พนักงานขาย</th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400 uppercase">ยอดรวม</th>
                                    <th className="text-center px-6 py-4 text-sm font-medium text-slate-400 uppercase">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-white font-mono">#{order.id.slice(0, 8)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-300">{formatDate(order.created_at)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-400">{order.seller_name || 'ไม่ระบุ'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white font-medium">{formatCurrency(order.total_amount)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${order.status === 'COMPLETED'
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {order.status === 'COMPLETED' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/50">
                            <p className="text-slate-500 text-sm">แสดง {orders.length} รายการ</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
