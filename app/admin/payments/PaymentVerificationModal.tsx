'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { verifyPayment } from './actions';
import { X, Check, Loader2, Maximize2, Calendar } from 'lucide-react';
import Image from 'next/image';

interface Transaction {
    id: string;
    organization_id: string;
    amount: number;
    slip_url: string;
    notes?: string;
    organizations: {
        name: string;
        subscription_plan: string;
    };
}

// Helper to format date for input
function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
}

// Helper to get default expiry date (+30 days)
function getDefaultExpiryDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return formatDateForInput(date);
}

export default function PaymentVerificationModal({ transaction }: { transaction: any }) {
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [expiryDate, setExpiryDate] = useState(getDefaultExpiryDate());

    useEffect(() => {
        if (isOpen && transaction.slip_url) {
            getSignedUrl();
        }
    }, [isOpen]);

    async function getSignedUrl() {
        const { data, error } = await supabase
            .storage
            .from('payment-slips')
            .createSignedUrl(transaction.slip_url, 60 * 60); // 1 hour

        if (data?.signedUrl) {
            setSignedUrl(data.signedUrl);
        } else {
            console.error('Error signing URL:', error);
        }
    }

    const handleVerify = async (status: 'approved' | 'rejected') => {
        if (status === 'rejected' && !showRejectInput) {
            setShowRejectInput(true);
            return;
        }

        setProcessing(true);
        try {
            const result = await verifyPayment(
                transaction.id,
                status,
                status === 'rejected' ? rejectNotes : undefined,
                status === 'approved' ? expiryDate : undefined
            );
            if (result.success) {
                setIsOpen(false);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('Something went wrong');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors text-xs font-bold"
            >
                ตรวจสอบ
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl">

                        {/* Left: Image Preview */}
                        <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative min-h-[400px]">
                            {signedUrl ? (
                                <div className="relative w-full h-full min-h-[400px]">
                                    <img
                                        src={signedUrl}
                                        alt="Slip"
                                        className="absolute inset-0 w-full h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="text-slate-500 flex flex-col items-center">
                                    <Loader2 className="animate-spin mb-2" />
                                    <span>Loading Image...</span>
                                </div>
                            )}
                        </div>

                        {/* Right: Actions */}
                        <div className="w-full md:w-1/3 p-6 flex flex-col border-l border-slate-800">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">ตรวจสอบสลิป</h2>
                                    <p className="text-slate-400 text-sm">Transaction ID: {transaction.id.slice(0, 8)}</p>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4 mb-auto">
                                <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">ร้านค้า:</span>
                                        <span className="text-white font-medium">{transaction.organizations?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">จำนวนเงิน:</span>
                                        <span className="text-emerald-400 font-bold text-lg">฿{transaction.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">วันที่:</span>
                                        <span className="text-white text-sm">{new Date(transaction.payment_date).toLocaleString('th-TH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">หมายเหตุลูกค้า:</span>
                                        <span className="text-white text-sm">{transaction.notes || '-'}</span>
                                    </div>
                                </div>

                                {/* Expiry Date Picker - Only show when not rejecting */}
                                {!showRejectInput && (
                                    <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-lg">
                                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
                                            <Calendar size={16} />
                                            วันหมดอายุแพ็คเกจ
                                        </label>
                                        <input
                                            type="date"
                                            value={expiryDate}
                                            onChange={(e) => setExpiryDate(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            ค่าเริ่มต้น: +30 วัน | สามารถแก้ไขวันที่ได้ตามต้องการ
                                        </p>
                                    </div>
                                )}

                                {/* Reject Input */}
                                {showRejectInput && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-sm font-medium text-red-400 mb-2">ระบุเหตุผลที่ปฏิเสธ</label>
                                        <textarea
                                            value={rejectNotes}
                                            onChange={(e) => setRejectNotes(e.target.value)}
                                            className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                            rows={3}
                                            placeholder="เช่น สลิปไม่ชัดเจน, ยอดเงินไม่ถูกต้อง"
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6">
                                {!showRejectInput ? (
                                    <>
                                        <button
                                            onClick={() => handleVerify('rejected')}
                                            disabled={processing}
                                            className="px-4 py-3 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-300 rounded-xl font-bold transition-all border border-transparent hover:border-red-500/30"
                                        >
                                            ปฏิเสธ
                                        </button>
                                        <button
                                            onClick={() => handleVerify('approved')}
                                            disabled={processing}
                                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                            {processing ? <Loader2 className="animate-spin" /> : <Check />}
                                            อนุมัติ
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setShowRejectInput(false)}
                                            className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            onClick={() => handleVerify('rejected')}
                                            disabled={!rejectNotes || processing}
                                            className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                                        >
                                            {processing ? <Loader2 className="animate-spin" /> : 'ยืนยันการปฏิเสธ'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

