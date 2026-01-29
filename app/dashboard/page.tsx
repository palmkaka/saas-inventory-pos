import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

async function getDashboardData() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id, full_name, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile?.organization_id) {
        return {
            user,
            profile: null,
            stats: { totalSales: 0, totalOrders: 0, lowStock: 0, netProfit: 0 },
            recentOrders: []
        };
    }

    const organizationId = profile.organization_id;

    const { data: salesData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('organization_id', organizationId);

    const totalSales = salesData?.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0) || 0;

    const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

    const { count: lowStock } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .lt('current_stock', 10);

    const netProfit = totalSales * 0.3;

    const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5);

    return {
        user,
        profile,
        stats: {
            totalSales,
            totalOrders: totalOrders || 0,
            lowStock: lowStock || 0,
            netProfit,
        },
        recentOrders: recentOrders || []
    };
}

export default async function DashboardPage() {
    const data = await getDashboardData();

    if ('error' in data && data.error === 'Not authenticated') {
        redirect('/');
    }

    const { profile, stats = { totalSales: 0, totalOrders: 0, lowStock: 0, netProfit: 0 }, recentOrders = [] } = data;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
        return `${diffDays} วันที่แล้ว`;
    };

    const summaryCards = [
        { title: 'ยอดขายรวม', value: formatCurrency(stats.totalSales), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', type: 'success' },
        { title: 'กำไรสุทธิ', value: formatCurrency(stats.netProfit), icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', type: 'success' },
        { title: 'จำนวนออเดอร์', value: stats.totalOrders.toLocaleString() + ' รายการ', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', type: 'info' },
        { title: 'สินค้าใกล้หมด', value: stats.lowStock.toString() + ' รายการ', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', type: stats.lowStock > 0 ? 'warning' : 'success' },
    ];

    const getCardStyle = (type: string) => {
        switch (type) {
            case 'success': return { bg: 'bg-emerald-500/10', color: 'text-emerald-400' };
            case 'warning': return { bg: 'bg-yellow-500/10', color: 'text-yellow-400' };
            case 'info': return { bg: 'bg-blue-500/10', color: 'text-blue-400' };
            default: return { bg: 'bg-slate-500/10', color: 'text-slate-400' };
        }
    };

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">ภาพรวมธุรกิจ</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            สวัสดี, {profile?.full_name || 'ผู้ใช้งาน'}! นี่คือสรุปข้อมูลล่าสุดของคุณ
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors relative">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {stats.lowStock > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
                        <DashboardClient />
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
                {!profile && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-yellow-400">โปรไฟล์ของคุณยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มคุณเข้าองค์กร</p>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {summaryCards.map((card) => {
                        const style = getCardStyle(card.type);
                        return (
                            <div
                                key={card.title}
                                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all duration-200"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-slate-400 text-sm font-medium">{card.title}</p>
                                        <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl ${style.bg}`}>
                                        <svg className={`w-6 h-6 ${style.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Chart Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">วิเคราะห์ยอดขาย</h2>
                            <select className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option>7 วันล่าสุด</option>
                                <option>30 วันล่าสุด</option>
                                <option>90 วันล่าสุด</option>
                            </select>
                        </div>
                        <div className="h-64 bg-slate-700/30 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-600/50">
                            <div className="text-center">
                                <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                                <p className="text-slate-500">กราฟจะแสดงที่นี่</p>
                                <p className="text-slate-600 text-sm mt-1">กำลังพัฒนา...</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">ออเดอร์ล่าสุด</h2>
                        <div className="space-y-4">
                            {recentOrders.length > 0 ? (
                                recentOrders.map((order) => (
                                    <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                                        <div>
                                            <p className="text-white font-medium">#{order.id.slice(0, 8)}</p>
                                            <p className="text-slate-500 text-sm">{formatTimeAgo(order.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-medium">{formatCurrency(parseFloat(order.total_amount) || 0)}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {order.status === 'COMPLETED' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <p className="text-slate-500">ยังไม่มีออเดอร์</p>
                                    <p className="text-slate-600 text-sm mt-1">เริ่มขายเพื่อดูออเดอร์ที่นี่</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
