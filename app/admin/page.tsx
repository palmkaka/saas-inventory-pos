import { createClient } from '@/utils/supabase/server';
import { Building2, Users, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

async function getAdminStats() {
    const supabase = await createClient();

    // Get Total Organizations
    const { count: orgCount } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });

    // Get Total Users
    const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    // Get Recent Organizations (Last 5)
    const { data: recentOrgs } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    // Get Total Revenue
    const { data: payments } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('status', 'approved');

    const totalRevenue = payments?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

    return {
        orgCount: orgCount || 0,
        userCount: userCount || 0,
        recentOrgs: recentOrgs || [],
        totalRevenue
    };
}

export default async function AdminDashboard() {
    const stats = await getAdminStats();

    return (
        <div className="p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-white">Dashboard ภาพรวมระบบ</h1>
                <p className="text-slate-400 mt-2">ยินดีต้อนรับสู่ศูนย์บัญชาการ Super Admin</p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-500/10 p-3 rounded-lg text-blue-500">
                            <Building2 size={24} />
                        </div>
                        <span className="text-2xl font-bold text-white">{stats.orgCount}</span>
                    </div>
                    <h3 className="text-slate-400 font-medium">องค์กรทั้งหมด (Organizations)</h3>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-500">
                            <Users size={24} />
                        </div>
                        <span className="text-2xl font-bold text-white">{stats.userCount}</span>
                    </div>
                    <h3 className="text-slate-400 font-medium">ผู้ใช้งานทั้งหมด (Total Users)</h3>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-purple-500/10 p-3 rounded-lg text-purple-500">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-2xl font-bold text-emerald-400">฿{stats.totalRevenue.toLocaleString()}</span>
                    </div>
                    <h3 className="text-slate-400 font-medium">รายได้รวม (Total Revenue)</h3>
                    <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                        <TrendingUp size={12} />
                        Updated Real-time
                    </p>
                </div>
            </div>

            {/* Recent Signups */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">ลูกค้าที่เพิ่งสมัครล่าสุด</h2>
                    <Link href="/admin/organizations" className="text-blue-400 hover:text-blue-300 text-sm">
                        ดูทั้งหมด &rarr;
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">ชื่อร้านค้า (Organizaton)</th>
                                <th className="px-6 py-4">วันที่สมัคร</th>
                                <th className="px-6 py-4">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {stats.recentOrgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{org.name}</td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {new Date(org.created_at).toLocaleDateString('th-TH')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${org.is_blocked
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {org.is_blocked ? 'BLOCKED' : 'ACTIVE'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {stats.recentOrgs.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        ยังไม่มีข้อมูลร้านค้าในระบบ
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
