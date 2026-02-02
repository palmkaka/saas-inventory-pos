'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Shift {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    starting_cash: number;
    ending_cash: number | null;
    expected_cash: number | null;
    cash_difference: number | null;
    total_sales: number;
    total_orders: number;
    status: 'active' | 'closed';
    notes: string | null;
    profiles?: {
        full_name: string | null;
        email: string;
    };
}

interface Props {
    initialActiveShift: Shift | null;
    initialHistory: Shift[];
    userRole: string;
    userId: string;
    organizationId: string;
}

export default function ShiftClient({ initialActiveShift, initialHistory, userRole, userId, organizationId }: Props) {
    const supabase = createClient();
    const router = useRouter();
    const [activeShift, setActiveShift] = useState<Shift | null>(initialActiveShift);
    const [history, setHistory] = useState<Shift[]>(initialHistory);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [showStartModal, setShowStartModal] = useState(false);
    const [showEndModal, setShowEndModal] = useState(false);
    const [cashInput, setCashInput] = useState('');
    const [notesInput, setNotesInput] = useState('');

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(dateString));
    };

    // Sync state with server props when they change (e.g. after router.refresh)
    useEffect(() => {
        setActiveShift(initialActiveShift);
        setHistory(initialHistory);
    }, [initialActiveShift, initialHistory]);

    // Start Shift
    const handleStartShift = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('shifts')
                .insert({
                    organization_id: organizationId,
                    user_id: userId,
                    starting_cash: Number(cashInput),
                    status: 'active',
                    started_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            setActiveShift(data);
            setShowStartModal(false);
            setCashInput('');
            router.refresh();
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // End Shift
    const handleEndShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeShift) return;
        setLoading(true);

        const endingCash = Number(cashInput);
        const expectedCash = activeShift.starting_cash + activeShift.total_sales;
        const diff = endingCash - expectedCash;

        try {
            const { data, error } = await supabase
                .from('shifts')
                .update({
                    ending_cash: endingCash,
                    expected_cash: expectedCash,
                    cash_difference: diff,
                    notes: notesInput || null,
                    status: 'closed',
                    ended_at: new Date().toISOString()
                })
                .eq('id', activeShift.id)
                .select()
                .single();

            if (error) throw error;

            setActiveShift(null);

            // Smart update history: Update if exists, else prepend
            setHistory(prev => {
                const exists = prev.some(s => s.id === data.id);
                if (exists) {
                    return prev.map(s => s.id === data.id ? { ...data, profiles: s.profiles } : s);
                }
                return [data, ...prev];
            });

            setShowEndModal(false);
            setCashInput('');
            setNotesInput('');
            router.refresh();
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Active Shift Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white mb-1">
                            สถานะ: {activeShift ? <span className="text-emerald-400">กำลังทำงาน (Active)</span> : <span className="text-slate-400">ยังไม่เริ่มกะ</span>}
                        </h2>
                        {activeShift && (
                            <p className="text-slate-400 text-sm">
                                เริ่มกะเมื่อ: {formatDate(activeShift.started_at)}
                            </p>
                        )}
                    </div>

                    {!activeShift ? (
                        <button
                            onClick={() => setShowStartModal(true)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
                        >
                            เริ่มกะงาน (Start Shift)
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <div className="bg-slate-900 rounded-lg px-4 py-2 text-right">
                                <span className="block text-slate-400 text-xs">ยอดขายในกะ</span>
                                <span className="block text-emerald-400 font-bold text-lg">{formatCurrency(activeShift.total_sales)}</span>
                            </div>
                            <button
                                onClick={() => setShowEndModal(true)}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-red-500/20"
                            >
                                ปิดกะ (End Shift)
                            </button>
                        </div>
                    )}
                </div>

                {activeShift && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-700/30 p-4 rounded-lg">
                            <span className="text-slate-400 text-sm">เงินทอนเริ่มต้น</span>
                            <div className="text-white font-bold text-lg">{formatCurrency(activeShift.starting_cash)}</div>
                        </div>
                        <div className="bg-slate-700/30 p-4 rounded-lg">
                            <span className="text-slate-400 text-sm">จำนวนออเดอร์</span>
                            <div className="text-white font-bold text-lg">{activeShift.total_orders}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Shift History */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">ประวัติกะการทำงาน</h3>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">พนักงาน</th>
                                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">เวลาเข้า-ออก</th>
                                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">เงินเริ่ม</th>
                                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">ยอดขาย</th>
                                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">เงินสดสุทธิ</th>
                                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">ส่วนต่าง</th>
                                    <th className="px-6 py-4 text-center text-sm font-medium text-slate-300">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {history.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{shift.profiles?.full_name || 'Unknown'}</div>
                                            <div className="text-slate-400 text-xs">{shift.profiles?.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white text-sm">{formatDate(shift.started_at)}</div>
                                            {shift.ended_at && (
                                                <div className="text-slate-400 text-xs">ถึง {formatDate(shift.ended_at)}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-300">
                                            {formatCurrency(shift.starting_cash)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                                            +{formatCurrency(shift.total_sales)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-white">
                                            {shift.ending_cash ? formatCurrency(shift.ending_cash) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {shift.cash_difference !== null ? (
                                                <span className={`${shift.cash_difference < 0 ? 'text-red-400' : 'text-emerald-400'} font-bold`}>
                                                    {shift.cash_difference > 0 ? '+' : ''}{formatCurrency(shift.cash_difference)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${shift.status === 'active'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {shift.status === 'active' ? 'ACTIVE' : 'CLOSED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Start Shift Modal */}
            {showStartModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">เริ่มกะงานใหม่</h3>
                        <form onSubmit={handleStartShift} className="space-y-4">
                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    เงินสดในลิ้นชัก (Starting Cash)
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={cashInput}
                                    onChange={(e) => setCashInput(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowStartModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !cashInput}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                                >
                                    ยืนยันเริ่มกะ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* End Shift Modal */}
            {showEndModal && activeShift && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">ปิดกะงาน</h3>

                        <div className="bg-slate-700/30 rounded-lg p-4 mb-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">เงินเริ่มกะ:</span>
                                <span className="text-white">{formatCurrency(activeShift.starting_cash)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">ยอดขายเงินสด:</span>
                                <span className="text-emerald-400">+{formatCurrency(activeShift.total_sales)}</span>
                            </div>
                            <div className="border-t border-slate-600/50 pt-2 flex justify-between font-bold">
                                <span className="text-white">ยอดที่ควรมี:</span>
                                <span className="text-blue-400">{formatCurrency(activeShift.starting_cash + activeShift.total_sales)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleEndShift} className="space-y-4">
                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    เงินสดที่นับได้จริง (Ending Cash)
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={cashInput}
                                    onChange={(e) => setCashInput(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg font-bold"
                                    placeholder="0.00"
                                />
                            </div>

                            {cashInput && (
                                <div className={`p-3 rounded-lg text-sm font-medium text-center ${Number(cashInput) - (activeShift.starting_cash + activeShift.total_sales) < 0
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                    }`}>
                                    ส่วนต่าง: {formatCurrency(Number(cashInput) - (activeShift.starting_cash + activeShift.total_sales))}
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    หมายเหตุ (ถ้ามี)
                                </label>
                                <textarea
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    rows={2}
                                    placeholder="สาเหตุที่เงินขาด/เกิน..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowEndModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !cashInput}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                                >
                                    ยืนยันปิดกะ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
