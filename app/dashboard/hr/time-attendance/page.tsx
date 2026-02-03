'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import TimeClock from '@/app/dashboard/components/TimeClock';

interface TimeEntry {
    id: string;
    clock_in: string;
    clock_out: string | null;
    work_duration_minutes: number | null;
    status: string;
    user_id: string;
    profile: {
        first_name: string;
        last_name: string;
        email: string;
    };
    branch: {
        name: string;
    } | null;
}

export default function TimeAttendancePage() {
    const supabase = createClient();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        async function fetchEntries() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, organization_id, is_platform_admin')
                .eq('id', user.id)
                .single();

            if (!profile) return;

            const isOwnerOrManager = ['owner', 'manager'].includes(profile.role);
            setIsAdmin(isOwnerOrManager);

            let effectiveOrgId = profile.organization_id;

            // Impersonation Logic
            if (profile.is_platform_admin) {
                const match = document.cookie.match(new RegExp('(^| )x-impersonate-org-id-v2=([^;]+)'));
                if (match) {
                    effectiveOrgId = match[2];
                    // If impersonating, treat as admin/manager to see all data
                    setIsAdmin(true);
                }
            }

            let query = supabase
                .from('time_entries')
                .select(`
                    *,
                    profile:profiles(first_name, last_name, email),
                    branch:branches(name)
                `)
                .eq('organization_id', effectiveOrgId)
                .gte('clock_in', `${startDate}T00:00:00`)
                .lte('clock_in', `${endDate}T23:59:59`)
                .order('clock_in', { ascending: false });

            // If not admin, see only own entries
            if (!isOwnerOrManager) {
                query = query.eq('user_id', user.id);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching time entries:', error);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setEntries(data as any[] || []);
            }
            setLoading(false);
        }

        fetchEntries();
    }, [startDate, endDate, supabase]);

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return '-';
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        return `${h} ชม. ${m} นาที`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">บันทึกเวลาทำงาน (Time Attendance)</h1>
                    <p className="text-slate-400">ประวัติการเข้า-ออกงานของพนักงาน</p>
                </div>

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
            </div>

            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Time Clock Widget */}
                <div className="md:col-span-1">
                    <TimeClock />
                </div>

                {/* Stats or other info could go here */}
                <div className="md:col-span-2 bg-slate-800/30 border border-slate-700 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                    <h3 className="text-slate-400 mb-2">เข้างานวันนี้</h3>
                    <div className="text-3xl font-bold text-white mb-1">
                        {entries.filter(e => new Date(e.clock_in).toDateString() === new Date().toDateString()).length} คน
                    </div>
                    <p className="text-sm text-slate-500">พนักงานที่ลงเวลาเข้างานแล้ว</p>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase font-medium">
                            <tr>
                                <th className="px-6 py-4">พนักงาน</th>
                                <th className="px-6 py-4">วันที่</th>
                                <th className="px-6 py-4">สาขา</th>
                                <th className="px-6 py-4">เวลาเข้า (In)</th>
                                <th className="px-6 py-4">เวลาออก (Out)</th>
                                <th className="px-6 py-4">ระยะเวลา</th>
                                <th className="px-6 py-4">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                        ไม่พบรายการในช่วงเวลานี้
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-white">
                                                {entry.profile?.first_name} {entry.profile?.last_name}
                                            </div>
                                            <div className="text-xs text-slate-500">{entry.profile?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                            {new Date(entry.clock_in).toLocaleDateString('th-TH')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                            {entry.branch?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-emerald-400 font-mono">
                                            {new Date(entry.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-red-400 font-mono">
                                            {entry.clock_out
                                                ? new Date(entry.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                            {formatDuration(entry.work_duration_minutes)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${entry.status === 'ON_DUTY'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                                }`}>
                                                {entry.status === 'ON_DUTY' ? 'กำลังทำงาน' : 'ออกงานแล้ว'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
