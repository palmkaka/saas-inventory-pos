'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { exportToExcel, exportToPDF, exportPayslipPDF } from '@/utils/export';

interface PayrollPeriod {
    id: string;
    period_name: string;
    period_start: string;
    period_end: string;
    status: string;
    calculated_at: string | null;
    paid_at: string | null;
}

interface PayrollRecord {
    id: string;
    user_id: string;
    base_salary: number;
    hours_worked: number;
    days_worked: number;
    position_allowance: number;
    diligence_allowance: number;
    other_allowance: number;
    commission_total: number;
    total_earnings: number;
    social_security: number;
    withholding_tax: number;
    loan_deduction: number;
    other_deduction: number;
    total_deductions: number;
    net_salary: number;
    profile: {
        first_name: string;
        last_name: string;
        email: string;
    };
}

export default function PayrollPage() {
    const supabase = createClient();
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    // New period modal
    const [isNewPeriodOpen, setIsNewPeriodOpen] = useState(false);
    const [periodName, setPeriodName] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');

    useEffect(() => {
        fetchPeriods();
    }, []);

    async function fetchPeriods() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return;
        setOrganizationId(profile.organization_id);

        const { data: periodsData } = await supabase
            .from('payroll_periods')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('period_start', { ascending: false });

        setPeriods(periodsData || []);
        setLoading(false);
    }

    async function fetchRecords(periodId: string) {
        const { data } = await supabase
            .from('payroll_records')
            .select(`
                *,
                profile:profiles(first_name, last_name, email)
            `)
            .eq('period_id', periodId)
            .order('net_salary', { ascending: false });

        setRecords((data || []) as PayrollRecord[]);
    }

    const selectPeriod = async (period: PayrollPeriod) => {
        setSelectedPeriod(period);
        await fetchRecords(period.id);
    };

    const handleCreatePeriod = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId) return;

        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('payroll_periods').insert({
            organization_id: organizationId,
            period_name: periodName,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'DRAFT',
            created_by: user?.id
        });

        setIsNewPeriodOpen(false);
        setPeriodName('');
        setPeriodStart('');
        setPeriodEnd('');
        fetchPeriods();
    };

    const calculatePayroll = async () => {
        if (!selectedPeriod || !organizationId) return;
        setCalculating(true);

        try {
            // Fetch all employees with salary settings
            const { data: salaries } = await supabase
                .from('employee_salaries')
                .select('*')
                .eq('organization_id', organizationId);

            if (!salaries || salaries.length === 0) {
                alert('ไม่พบข้อมูลเงินเดือนพนักงาน กรุณาตั้งค่าก่อน');
                setCalculating(false);
                return;
            }

            // Fetch time entries for the period
            const { data: timeEntries } = await supabase
                .from('time_entries')
                .select('user_id, work_duration_minutes')
                .eq('organization_id', organizationId)
                .eq('status', 'COMPLETED')
                .gte('clock_in', `${selectedPeriod.period_start}T00:00:00`)
                .lte('clock_in', `${selectedPeriod.period_end}T23:59:59`);

            // Fetch commissions for the period
            const { data: commissions } = await supabase
                .from('commission_records')
                .select('user_id, commission_amount')
                .eq('organization_id', organizationId)
                .gte('created_at', `${selectedPeriod.period_start}T00:00:00`)
                .lte('created_at', `${selectedPeriod.period_end}T23:59:59`);

            // Fetch active loans
            const { data: loans } = await supabase
                .from('employee_loans')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('status', 'ACTIVE');

            // Calculate for each employee
            const payrollRecords = [];

            for (const salary of salaries) {
                // Calculate hours worked
                const userTimeEntries = (timeEntries || []).filter(t => t.user_id === salary.user_id);
                const totalMinutes = userTimeEntries.reduce((sum, t) => sum + (t.work_duration_minutes || 0), 0);
                const hoursWorked = totalMinutes / 60;
                const daysWorked = Math.ceil(hoursWorked / 8);

                // Calculate base salary
                let baseSalary = 0;
                if (salary.salary_type === 'MONTHLY') {
                    baseSalary = salary.base_amount;
                } else if (salary.salary_type === 'DAILY') {
                    baseSalary = salary.base_amount * daysWorked;
                } else if (salary.salary_type === 'HOURLY') {
                    baseSalary = salary.base_amount * hoursWorked;
                }

                // Calculate commission
                const userCommissions = (commissions || []).filter(c => c.user_id === salary.user_id);
                const commissionTotal = userCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

                // Calculate allowances
                const positionAllowance = salary.position_allowance || 0;
                const diligenceAllowance = salary.diligence_allowance || 0;
                const otherAllowance = salary.other_allowance || 0;

                // Total earnings
                const totalEarnings = baseSalary + commissionTotal + positionAllowance + diligenceAllowance + otherAllowance;

                // Calculate deductions
                let socialSecurity = 0;
                if (salary.social_security_enabled) {
                    socialSecurity = Math.min(totalEarnings * 0.05, 750); // Max 750 baht
                }

                let withholdingTax = 0;
                if (salary.withholding_tax_enabled && totalEarnings > 26000) {
                    // Simple progressive tax calculation
                    withholdingTax = (totalEarnings - 26000) * 0.05;
                }

                // Calculate loan deductions
                const userLoans = (loans || []).filter(l => l.user_id === salary.user_id);
                const loanDeduction = userLoans.reduce((sum, l) => sum + (l.monthly_deduction || 0), 0);

                const totalDeductions = socialSecurity + withholdingTax + loanDeduction;
                const netSalary = totalEarnings - totalDeductions;

                payrollRecords.push({
                    organization_id: organizationId,
                    period_id: selectedPeriod.id,
                    user_id: salary.user_id,
                    base_salary: baseSalary,
                    hours_worked: hoursWorked,
                    days_worked: daysWorked,
                    position_allowance: positionAllowance,
                    diligence_allowance: diligenceAllowance,
                    other_allowance: otherAllowance,
                    commission_total: commissionTotal,
                    total_earnings: totalEarnings,
                    social_security: socialSecurity,
                    withholding_tax: withholdingTax,
                    loan_deduction: loanDeduction,
                    other_deduction: 0,
                    total_deductions: totalDeductions,
                    net_salary: netSalary
                });
            }

            // Delete existing records for this period
            await supabase.from('payroll_records').delete().eq('period_id', selectedPeriod.id);

            // Insert new records
            if (payrollRecords.length > 0) {
                await supabase.from('payroll_records').insert(payrollRecords);
            }

            // Update period status
            await supabase
                .from('payroll_periods')
                .update({ status: 'CALCULATED', calculated_at: new Date().toISOString() })
                .eq('id', selectedPeriod.id);

            // Refresh data
            await fetchPeriods();
            await fetchRecords(selectedPeriod.id);
            setSelectedPeriod({ ...selectedPeriod, status: 'CALCULATED' });

            alert('คำนวณเงินเดือนเสร็จสิ้น!');
        } catch (error) {
            console.error('Calculation error:', error);
            alert('เกิดข้อผิดพลาดในการคำนวณ');
        } finally {
            setCalculating(false);
        }
    };

    const markAsPaid = async () => {
        if (!selectedPeriod) return;
        if (!confirm('ยืนยันการจ่ายเงินเดือนงวดนี้?')) return;

        await supabase
            .from('payroll_periods')
            .update({ status: 'PAID', paid_at: new Date().toISOString() })
            .eq('id', selectedPeriod.id);

        await fetchPeriods();
        setSelectedPeriod({ ...selectedPeriod, status: 'PAID' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-slate-500/20 text-slate-400';
            case 'CALCULATED': return 'bg-amber-500/20 text-amber-400';
            case 'APPROVED': return 'bg-blue-500/20 text-blue-400';
            case 'PAID': return 'bg-emerald-500/20 text-emerald-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'ร่าง';
            case 'CALCULATED': return 'คำนวณแล้ว';
            case 'APPROVED': return 'อนุมัติแล้ว';
            case 'PAID': return 'จ่ายแล้ว';
            default: return status;
        }
    };

    const totalNetSalary = records.reduce((sum, r) => sum + r.net_salary, 0);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">ระบบเงินเดือน</h1>
                    <p className="text-slate-400">จัดการงวดเงินเดือนและคำนวณเงินเดือนพนักงาน</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/dashboard/settings/payroll"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                        ⚙️ ตั้งค่าเงินเดือน
                    </Link>
                    <button
                        onClick={() => setIsNewPeriodOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        สร้างงวดใหม่
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Periods List */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <h2 className="text-lg font-bold mb-4">งวดเงินเดือน</h2>
                    {loading ? (
                        <p className="text-slate-400">กำลังโหลด...</p>
                    ) : periods.length === 0 ? (
                        <p className="text-slate-400 text-sm">ยังไม่มีงวดเงินเดือน</p>
                    ) : (
                        <div className="space-y-2">
                            {periods.map(period => (
                                <button
                                    key={period.id}
                                    onClick={() => selectPeriod(period)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedPeriod?.id === period.id
                                        ? 'bg-blue-600'
                                        : 'bg-slate-700/50 hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="font-medium">{period.period_name}</div>
                                    <div className="text-xs text-slate-400">
                                        {new Date(period.period_start).toLocaleDateString('th-TH')} - {new Date(period.period_end).toLocaleDateString('th-TH')}
                                    </div>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${getStatusBadge(period.status)}`}>
                                        {getStatusLabel(period.status)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payroll Details */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    {selectedPeriod ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold">{selectedPeriod.period_name}</h2>
                                    <p className="text-slate-400 text-sm">
                                        {new Date(selectedPeriod.period_start).toLocaleDateString('th-TH')} - {new Date(selectedPeriod.period_end).toLocaleDateString('th-TH')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedPeriod.status === 'DRAFT' && (
                                        <button
                                            onClick={calculatePayroll}
                                            disabled={calculating}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                                        >
                                            {calculating ? 'กำลังคำนวณ...' : '🧮 คำนวณเงินเดือน'}
                                        </button>
                                    )}
                                    {selectedPeriod.status === 'CALCULATED' && (
                                        <button
                                            onClick={markAsPaid}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                        >
                                            💵 จ่ายเงินเดือน
                                        </button>
                                    )}
                                    {records.length > 0 && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const data = records.map(r => ({
                                                        'พนักงาน': `${r.profile?.first_name} ${r.profile?.last_name}`,
                                                        'เงินเดือน': r.base_salary,
                                                        'คอมมิชชั่น': r.commission_total,
                                                        'รายรับรวม': r.total_earnings,
                                                        'หักรวม': r.total_deductions,
                                                        'สุทธิ': r.net_salary,
                                                    }));
                                                    exportToExcel(data, `payroll_${selectedPeriod.period_name}`, 'Payroll');
                                                }}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                            >
                                                📊 Excel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const data = records.map(r => ({
                                                        employee: `${r.profile?.first_name} ${r.profile?.last_name}`,
                                                        base: r.base_salary,
                                                        comm: r.commission_total,
                                                        total: r.total_earnings,
                                                        deduct: r.total_deductions,
                                                        net: r.net_salary,
                                                    }));
                                                    exportToPDF(
                                                        data,
                                                        [
                                                            { header: 'Employee', dataKey: 'employee' },
                                                            { header: 'Base', dataKey: 'base' },
                                                            { header: 'Commission', dataKey: 'comm' },
                                                            { header: 'Total', dataKey: 'total' },
                                                            { header: 'Deductions', dataKey: 'deduct' },
                                                            { header: 'Net', dataKey: 'net' },
                                                        ],
                                                        `Payroll Report: ${selectedPeriod.period_name}`,
                                                        `payroll_${selectedPeriod.period_name}`
                                                    );
                                                }}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                            >
                                                📄 PDF
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Summary Card */}
                            {records.length > 0 && (
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-blue-200 text-sm">ยอดเงินเดือนรวม</p>
                                            <p className="text-3xl font-bold text-white">฿{formatCurrency(totalNetSalary)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-blue-200 text-sm">จำนวนพนักงาน</p>
                                            <p className="text-2xl font-bold text-white">{records.length} คน</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Records Table */}
                            {records.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-800 text-slate-400 uppercase">
                                            <tr>
                                                <th className="px-4 py-3">พนักงาน</th>
                                                <th className="px-4 py-3 text-right">เงินเดือน</th>
                                                <th className="px-4 py-3 text-right">คอมมิชชั่น</th>
                                                <th className="px-4 py-3 text-right">รายรับรวม</th>
                                                <th className="px-4 py-3 text-right">หักรวม</th>
                                                <th className="px-4 py-3 text-right">สุทธิ</th>
                                                <th className="px-4 py-3">สลิป</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {records.map(record => (
                                                <tr key={record.id} className="hover:bg-slate-700/30">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-white">
                                                            {record.profile?.first_name} {record.profile?.last_name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-300">
                                                        ฿{formatCurrency(record.base_salary)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-emerald-400">
                                                        {record.commission_total > 0 ? `+฿${formatCurrency(record.commission_total)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-white">
                                                        ฿{formatCurrency(record.total_earnings)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-red-400">
                                                        -฿{formatCurrency(record.total_deductions)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-white">
                                                        ฿{formatCurrency(record.net_salary)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => {
                                                                exportPayslipPDF(
                                                                    {
                                                                        name: `${record.profile?.first_name || ''} ${record.profile?.last_name || ''}`.trim(),
                                                                        email: record.profile?.email || ''
                                                                    },
                                                                    {
                                                                        base_salary: record.base_salary,
                                                                        position_allowance: record.position_allowance,
                                                                        diligence_allowance: record.diligence_allowance,
                                                                        other_allowance: record.other_allowance,
                                                                        commission_total: record.commission_total,
                                                                        total_earnings: record.total_earnings,
                                                                        social_security: record.social_security,
                                                                        withholding_tax: record.withholding_tax,
                                                                        loan_deduction: record.loan_deduction,
                                                                        other_deduction: record.other_deduction,
                                                                        total_deductions: record.total_deductions,
                                                                        net_salary: record.net_salary
                                                                    },
                                                                    {
                                                                        name: selectedPeriod?.period_name || '',
                                                                        start: selectedPeriod?.period_start || '',
                                                                        end: selectedPeriod?.period_end || ''
                                                                    },
                                                                    { name: 'SaaS Inventory POS' }
                                                                );
                                                            }}
                                                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                                        >
                                                            📄 PDF
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-center py-8">
                                    {selectedPeriod.status === 'DRAFT'
                                        ? 'กด "คำนวณเงินเดือน" เพื่อเริ่มต้น'
                                        : 'ไม่มีข้อมูล'}
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="text-center text-slate-400 py-12">
                            เลือกงวดเงินเดือนจากรายการด้านซ้าย
                        </div>
                    )}
                </div>
            </div>

            {/* New Period Modal */}
            {isNewPeriodOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">สร้างงวดเงินเดือนใหม่</h3>
                        <form onSubmit={handleCreatePeriod} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ชื่องวด</label>
                                <input
                                    type="text"
                                    required
                                    value={periodName}
                                    onChange={e => setPeriodName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="เช่น มกราคม 2569"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">วันเริ่มต้น</label>
                                    <input
                                        type="date"
                                        required
                                        value={periodStart}
                                        onChange={e => setPeriodStart(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">วันสิ้นสุด</label>
                                    <input
                                        type="date"
                                        required
                                        value={periodEnd}
                                        onChange={e => setPeriodEnd(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsNewPeriodOpen(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold"
                                >
                                    สร้าง
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
