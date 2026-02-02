'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
}

interface EmployeeSalary {
    id: string;
    user_id: string;
    salary_type: 'MONTHLY' | 'DAILY' | 'HOURLY';
    base_amount: number;
    position_allowance: number;
    diligence_allowance: number;
    other_allowance: number;
    social_security_enabled: boolean;
    withholding_tax_enabled: boolean;
}

interface EmployeeLoan {
    id: string;
    user_id: string;
    loan_name: string;
    total_amount: number;
    monthly_deduction: number;
    remaining_amount: number;
    status: string;
}

export default function PayrollSettingsPage() {
    const supabase = createClient();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [salaries, setSalaries] = useState<Map<string, EmployeeSalary>>(new Map());
    const [loans, setLoans] = useState<EmployeeLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Salary form
    const [salaryType, setSalaryType] = useState<'MONTHLY' | 'DAILY' | 'HOURLY'>('MONTHLY');
    const [baseAmount, setBaseAmount] = useState('');
    const [positionAllowance, setPositionAllowance] = useState('');
    const [diligenceAllowance, setDiligenceAllowance] = useState('');
    const [otherAllowance, setOtherAllowance] = useState('');
    const [socialSecurityEnabled, setSocialSecurityEnabled] = useState(true);
    const [withholdingTaxEnabled, setWithholdingTaxEnabled] = useState(true);

    // Loan form
    const [loanName, setLoanName] = useState('');
    const [loanTotal, setLoanTotal] = useState('');
    const [loanMonthly, setLoanMonthly] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
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

        // Fetch employees
        const { data: employeesData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .eq('organization_id', profile.organization_id)
            .order('first_name');

        // Fetch salaries
        const { data: salariesData } = await supabase
            .from('employee_salaries')
            .select('*')
            .eq('organization_id', profile.organization_id);

        // Fetch loans
        const { data: loansData } = await supabase
            .from('employee_loans')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('status', 'ACTIVE');

        setEmployees(employeesData || []);

        const salaryMap = new Map<string, EmployeeSalary>();
        (salariesData || []).forEach(s => salaryMap.set(s.user_id, s));
        setSalaries(salaryMap);

        setLoans(loansData || []);
        setLoading(false);
    }

    const openSalaryModal = (employee: Employee) => {
        setSelectedEmployee(employee);
        const existing = salaries.get(employee.id);
        if (existing) {
            setSalaryType(existing.salary_type);
            setBaseAmount(existing.base_amount.toString());
            setPositionAllowance(existing.position_allowance.toString());
            setDiligenceAllowance(existing.diligence_allowance.toString());
            setOtherAllowance(existing.other_allowance.toString());
            setSocialSecurityEnabled(existing.social_security_enabled);
            setWithholdingTaxEnabled(existing.withholding_tax_enabled);
        } else {
            setSalaryType('MONTHLY');
            setBaseAmount('');
            setPositionAllowance('0');
            setDiligenceAllowance('0');
            setOtherAllowance('0');
            setSocialSecurityEnabled(true);
            setWithholdingTaxEnabled(true);
        }
        setIsModalOpen(true);
    };

    const openLoanModal = (employee: Employee) => {
        setSelectedEmployee(employee);
        setLoanName('');
        setLoanTotal('');
        setLoanMonthly('');
        setIsLoanModalOpen(true);
    };

    const handleSaveSalary = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !organizationId) return;
        setLoading(true);

        const payload = {
            organization_id: organizationId,
            user_id: selectedEmployee.id,
            salary_type: salaryType,
            base_amount: parseFloat(baseAmount) || 0,
            position_allowance: parseFloat(positionAllowance) || 0,
            diligence_allowance: parseFloat(diligenceAllowance) || 0,
            other_allowance: parseFloat(otherAllowance) || 0,
            social_security_enabled: socialSecurityEnabled,
            withholding_tax_enabled: withholdingTaxEnabled,
            updated_at: new Date().toISOString()
        };

        const existing = salaries.get(selectedEmployee.id);
        if (existing) {
            await supabase.from('employee_salaries').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('employee_salaries').insert(payload);
        }

        setIsModalOpen(false);
        fetchData();
    };

    const handleSaveLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee || !organizationId) return;
        setLoading(true);

        const total = parseFloat(loanTotal) || 0;
        await supabase.from('employee_loans').insert({
            organization_id: organizationId,
            user_id: selectedEmployee.id,
            loan_name: loanName,
            total_amount: total,
            monthly_deduction: parseFloat(loanMonthly) || 0,
            remaining_amount: total,
            status: 'ACTIVE'
        });

        setIsLoanModalOpen(false);
        fetchData();
    };

    const getEmployeeLoans = (userId: string) => {
        return loans.filter(l => l.user_id === userId);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(amount);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">ตั้งค่าเงินเดือนพนักงาน</h1>
                <p className="text-slate-400">กำหนดเงินเดือน เบี้ยเลี้ยง และหนี้สินของพนักงาน</p>
            </div>

            {loading ? (
                <div className="text-center text-slate-400 py-8">กำลังโหลด...</div>
            ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-4">พนักงาน</th>
                                <th className="px-6 py-4">ประเภท</th>
                                <th className="px-6 py-4 text-right">เงินเดือนพื้นฐาน</th>
                                <th className="px-6 py-4 text-right">เบี้ยเลี้ยงรวม</th>
                                <th className="px-6 py-4 text-right">หนี้สิน</th>
                                <th className="px-6 py-4">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {employees.map((emp) => {
                                const salary = salaries.get(emp.id);
                                const empLoans = getEmployeeLoans(emp.id);
                                const totalAllowance = (salary?.position_allowance || 0) +
                                    (salary?.diligence_allowance || 0) + (salary?.other_allowance || 0);
                                const totalLoanRemaining = empLoans.reduce((sum, l) => sum + l.remaining_amount, 0);

                                return (
                                    <tr key={emp.id} className="hover:bg-slate-700/30">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">
                                                {emp.first_name} {emp.last_name}
                                            </div>
                                            <div className="text-xs text-slate-500">{emp.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {salary ? (
                                                <span className={`px-2 py-1 rounded text-xs ${salary.salary_type === 'MONTHLY' ? 'bg-blue-500/20 text-blue-400' :
                                                        salary.salary_type === 'DAILY' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-emerald-500/20 text-emerald-400'
                                                    }`}>
                                                    {salary.salary_type === 'MONTHLY' ? 'รายเดือน' :
                                                        salary.salary_type === 'DAILY' ? 'รายวัน' : 'รายชั่วโมง'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">ยังไม่ตั้งค่า</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-white">
                                            {salary ? `฿${formatCurrency(salary.base_amount)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-emerald-400">
                                            {totalAllowance > 0 ? `+฿${formatCurrency(totalAllowance)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {totalLoanRemaining > 0 ? (
                                                <span className="text-red-400 font-mono">
                                                    -฿{formatCurrency(totalLoanRemaining)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openSalaryModal(emp)}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                                                >
                                                    💰 เงินเดือน
                                                </button>
                                                <button
                                                    onClick={() => openLoanModal(emp)}
                                                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
                                                >
                                                    📋 หนี้สิน
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Salary Modal */}
            {isModalOpen && selectedEmployee && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            ตั้งค่าเงินเดือน: {selectedEmployee.first_name} {selectedEmployee.last_name}
                        </h3>
                        <form onSubmit={handleSaveSalary} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ประเภทเงินเดือน</label>
                                <select
                                    value={salaryType}
                                    onChange={e => setSalaryType(e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY')}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="MONTHLY">รายเดือน</option>
                                    <option value="DAILY">รายวัน</option>
                                    <option value="HOURLY">รายชั่วโมง</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">
                                    {salaryType === 'MONTHLY' ? 'เงินเดือน (บาท/เดือน)' :
                                        salaryType === 'DAILY' ? 'ค่าแรง (บาท/วัน)' : 'ค่าแรง (บาท/ชั่วโมง)'}
                                </label>
                                <input
                                    type="number"
                                    value={baseAmount}
                                    onChange={e => setBaseAmount(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="0"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">ค่าตำแหน่ง</label>
                                    <input
                                        type="number"
                                        value={positionAllowance}
                                        onChange={e => setPositionAllowance(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">เบี้ยขยัน</label>
                                    <input
                                        type="number"
                                        value={diligenceAllowance}
                                        onChange={e => setDiligenceAllowance(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">อื่นๆ</label>
                                    <input
                                        type="number"
                                        value={otherAllowance}
                                        onChange={e => setOtherAllowance(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={socialSecurityEnabled}
                                        onChange={e => setSocialSecurityEnabled(e.target.checked)}
                                        className="rounded"
                                    />
                                    หักประกันสังคม (5%)
                                </label>
                                <label className="flex items-center gap-2 text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={withholdingTaxEnabled}
                                        onChange={e => setWithholdingTaxEnabled(e.target.checked)}
                                        className="rounded"
                                    />
                                    หักภาษี ณ ที่จ่าย
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Loan Modal */}
            {isLoanModalOpen && selectedEmployee && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            เพิ่มหนี้สิน: {selectedEmployee.first_name} {selectedEmployee.last_name}
                        </h3>
                        <form onSubmit={handleSaveLoan} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ชื่อรายการ</label>
                                <input
                                    type="text"
                                    required
                                    value={loanName}
                                    onChange={e => setLoanName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="เช่น เงินกู้ยืม, ค่าเครื่องแบบ"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ยอดรวม (บาท)</label>
                                <input
                                    type="number"
                                    required
                                    value={loanTotal}
                                    onChange={e => setLoanTotal(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">หักต่อเดือน (บาท)</label>
                                <input
                                    type="number"
                                    required
                                    value={loanMonthly}
                                    onChange={e => setLoanMonthly(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsLoanModalOpen(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
