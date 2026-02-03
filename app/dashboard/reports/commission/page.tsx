'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { exportToExcel, exportToPDF } from '@/utils/export';

interface CommissionRecord {
    id: string;
    user_id: string;
    sale_amount: number;
    commission_amount: number;
    status: string;
    created_at: string;
    profile: {
        first_name: string;
        last_name: string;
        email: string;
    };
    order: {
        id: string;
        total_amount: number;
    };
}

interface StaffSummary {
    user_id: string;
    name: string;
    email: string;
    total_sales: number;
    total_commission: number;
    pending_commission: number;
    paid_commission: number;
}

export default function CommissionReportPage() {
    const supabase = createClient();
    const [records, setRecords] = useState<CommissionRecord[]>([]);
    const [staffSummary, setStaffSummary] = useState<StaffSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First day of month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    async function fetchData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role, is_platform_admin')
            .eq('id', user.id)
            .single();

        if (!profile) return;

        let effectiveOrgId = profile.organization_id;

        // Impersonation Logic
        if (profile.is_platform_admin) {
            const match = document.cookie.match(new RegExp('(^| )x-impersonate-org-id-v2=([^;]+)'));
            if (match) {
                effectiveOrgId = match[2];
            }
        }

        // Fetch commission records
        const { data: recordsData } = await supabase
            .from('commission_records')
            .select(`
                *,
                profile:profiles(first_name, last_name, email),
                order:orders(id, total_amount)
            `)
            .eq('organization_id', effectiveOrgId)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .order('created_at', { ascending: false });

        const allRecords = (recordsData || []) as CommissionRecord[];
        setRecords(allRecords);

        // Calculate staff summary
        const summaryMap = new Map<string, StaffSummary>();
        allRecords.forEach(record => {
            const existing = summaryMap.get(record.user_id) || {
                user_id: record.user_id,
                name: `${record.profile?.first_name || ''} ${record.profile?.last_name || ''}`.trim() || 'Unknown',
                email: record.profile?.email || '',
                total_sales: 0,
                total_commission: 0,
                pending_commission: 0,
                paid_commission: 0,
            };

            existing.total_sales += record.sale_amount;
            existing.total_commission += record.commission_amount;
            if (record.status === 'PENDING') {
                existing.pending_commission += record.commission_amount;
            } else if (record.status === 'PAID') {
                existing.paid_commission += record.commission_amount;
            }

            summaryMap.set(record.user_id, existing);
        });

        setStaffSummary(Array.from(summaryMap.values()).sort((a, b) => b.total_commission - a.total_commission));
        setLoading(false);
    }

    const markAsPaid = async (userId: string) => {
        if (!confirm('ยืนยันการจ่ายคอมมิชชั่นให้พนักงานคนนี้?')) return;

        await supabase
            .from('commission_records')
            .update({ status: 'PAID', paid_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('status', 'PENDING')
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        fetchData();
    };

    const totalCommission = staffSummary.reduce((sum, s) => sum + s.total_commission, 0);
    const totalPending = staffSummary.reduce((sum, s) => sum + s.pending_commission, 0);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">รายงานคอมมิชชั่น</h1>
                    <p className="text-slate-400">สรุปคอมมิชชั่นรายพนักงาน</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Date Filter */}
                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent text-white outline-none text-sm"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent text-white outline-none text-sm"
                        />
                    </div>
                    <button
                        onClick={() => {
                            const data = staffSummary.map(s => ({
                                'พนักงาน': s.name,
                                'ยอดขาย': s.total_sales,
                                'คอมมิชชั่น': s.total_commission,
                                'รอจ่าย': s.pending_commission,
                                'จ่ายแล้ว': s.paid_commission,
                            }));
                            exportToExcel(data, `commission_report_${startDate}_${endDate}`, 'Commission');
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
                    >
                        📊 Excel
                    </button>
                    <button
                        onClick={() => {
                            const data = staffSummary.map(s => ({
                                name: s.name,
                                total_sales: s.total_sales,
                                total_commission: s.total_commission,
                                pending_commission: s.pending_commission,
                                paid_commission: s.paid_commission,
                            }));
                            exportToPDF(
                                data,
                                [
                                    { header: 'Employee', dataKey: 'name' },
                                    { header: 'Sales', dataKey: 'total_sales' },
                                    { header: 'Commission', dataKey: 'total_commission' },
                                    { header: 'Pending', dataKey: 'pending_commission' },
                                    { header: 'Paid', dataKey: 'paid_commission' },
                                ],
                                `Commission Report: ${startDate} - ${endDate}`,
                                `commission_report_${startDate}_${endDate}`
                            );
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                    >
                        📄 PDF
                    </button>
                    <Link
                        href="/dashboard/settings/commission"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                        ⚙️ ตั้งค่า
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6">
                    <p className="text-blue-200 text-sm">ยอดคอมมิชชั่นรวม</p>
                    <p className="text-3xl font-bold text-white">฿{totalCommission.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-6">
                    <p className="text-amber-200 text-sm">รอจ่าย</p>
                    <p className="text-3xl font-bold text-white">฿{totalPending.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6">
                    <p className="text-emerald-200 text-sm">จำนวนพนักงาน</p>
                    <p className="text-3xl font-bold text-white">{staffSummary.length} คน</p>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                >
                    สรุปรายพนักงาน
                </button>
                <button
                    onClick={() => setViewMode('detail')}
                    className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'detail' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                >
                    รายละเอียดทุกรายการ
                </button>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
                ) : viewMode === 'summary' ? (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-4">พนักงาน</th>
                                <th className="px-6 py-4 text-right">ยอดขาย</th>
                                <th className="px-6 py-4 text-right">คอมมิชชั่นรวม</th>
                                <th className="px-6 py-4 text-right">รอจ่าย</th>
                                <th className="px-6 py-4 text-right">จ่ายแล้ว</th>
                                <th className="px-6 py-4">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {staffSummary.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                                        ไม่มีข้อมูลในช่วงเวลานี้
                                    </td>
                                </tr>
                            ) : (
                                staffSummary.map((staff) => (
                                    <tr key={staff.user_id} className="hover:bg-slate-700/30">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{staff.name}</div>
                                            <div className="text-xs text-slate-500">{staff.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-300">
                                            ฿{staff.total_sales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-white">
                                            ฿{staff.total_commission.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-amber-400">
                                            ฿{staff.pending_commission.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-400">
                                            ฿{staff.paid_commission.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4">
                                            {staff.pending_commission > 0 && (
                                                <button
                                                    onClick={() => markAsPaid(staff.user_id)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                                                >
                                                    จ่ายแล้ว
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-4">วันที่</th>
                                <th className="px-6 py-4">พนักงาน</th>
                                <th className="px-6 py-4 text-right">ยอดขาย</th>
                                <th className="px-6 py-4 text-right">คอมมิชชั่น</th>
                                <th className="px-6 py-4">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        ไม่มีข้อมูลในช่วงเวลานี้
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-700/30">
                                        <td className="px-6 py-4 text-slate-300">
                                            {new Date(record.created_at).toLocaleDateString('th-TH')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">
                                                {record.profile?.first_name} {record.profile?.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-300">
                                            ฿{record.sale_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-white">
                                            ฿{record.commission_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${record.status === 'PAID'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                {record.status === 'PAID' ? 'จ่ายแล้ว' : 'รอจ่าย'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
