'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { submitPayment, getBillingInfo } from './actions';
import { CreditCard, Upload, X, CheckCircle, Clock, AlertCircle, RefreshCw, History, FileText } from 'lucide-react';
import Image from 'next/image';

interface PaymentTransaction {
    id: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    payment_date: string;
    slip_url: string;
    notes?: string;
}

interface Subscription {
    plan: string;
    status: string;
    expires_at: string | null;
}

export default function BillingPage() {
    const supabase = createClient();
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadBillingData();
    }, [supabase]);

    async function loadBillingData() {
        setLoading(true);
        try {
            const billingData = await getBillingInfo();

            if (billingData.error || !billingData.subscription) {
                console.error('Error loading billing:', billingData.error);
                return;
            }

            setOrganizationId(billingData.organizationId);
            setSubscription(billingData.subscription);
            setTransactions(billingData.transactions as PaymentTransaction[]);

        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || !selectedFile || !amount) return;

        setUploading(true);

        try {
            // 1. Upload Slip to Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${organizationId}/${Date.now()}.${fileExt}`;

            const { error: uploadError, data } = await supabase.storage
                .from('payment-slips')
                .upload(fileName, selectedFile);

            if (uploadError) throw uploadError;

            // 2. Get Public URL (or just path if using private bucket and signing later)
            // Ideally we store the path and sign it when viewing. 
            // For simplicity in this demo we might assume public or just store the path.
            // But 'payment-slips' bucket is likely private.
            // Let's store the full path.
            const slipPath = data.path;

            // 3. Submit to Server
            const formData = new FormData();
            formData.append('organizationId', organizationId);
            formData.append('amount', amount);
            formData.append('slipUrl', slipPath); // Sending path, server/client can sign it later
            formData.append('notes', notes);

            const result = await submitPayment(formData);

            if (result.error) throw new Error(result.error);

            // Success
            setIsModalOpen(false);
            resetForm();
            loadBillingData(); // Refresh list

        } catch (error) {
            console.error('Payment submission error:', error);
            alert('เกิดข้อผิดพลาดในการแจ้งชำระเงิน กรุณาลองใหม่อีกครั้ง');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setAmount('');
        setNotes('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-500/20">อนุมัติแล้ว</span>;
            case 'rejected': return <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20">ปฏิเสธ</span>;
            default: return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold border border-yellow-500/20">รอตรวจสอบ</span>;
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading billing info...</div>;

    return (
        <div className="min-h-screen bg-slate-900 p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">แพ็กเกจและการชำระเงิน (Billing)</h1>
                <p className="text-slate-400">ตรวจสอบสถานะและแจ้งโอนเงิน</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Current Plan */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4 text-blue-400">
                            <CreditCard size={24} />
                            <h2 className="text-xl font-bold text-white">แพ็กเกจปัจจุบัน</h2>
                        </div>

                        <div className="mb-6">
                            <div className="text-3xl font-bold text-white mb-1 uppercase">{subscription?.plan || 'FREE'}</div>
                            <div className="text-slate-400 text-sm">
                                {subscription?.status === 'active'
                                    ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> ใช้งานได้ปกติ</span>
                                    : <span className="text-red-400 flex items-center gap-1"><AlertCircle size={14} /> ระงับการใช้งาน</span>}
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">วันหมดอายุ:</span>
                                <span className="text-white font-medium">
                                    {subscription?.expires_at
                                        ? new Date(subscription.expires_at).toLocaleDateString('th-TH')
                                        : 'ไม่มีวันหมดอายุ'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Upload size={18} />
                            แจ้งชำระเงิน / อัปโหลดสลิป
                        </button>
                    </div>

                    {/* Bank Info Card (Mockup) */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">ช่องทางการชำระเงิน</h3>
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">SCB</div>
                            <div>
                                <div className="text-white font-medium">ธนาคารไทยพาณิชย์</div>
                                <div className="text-slate-400 text-sm">123-456-7890</div>
                                <div className="text-slate-500 text-xs">บจก. ซาส อินเวนทอรี่</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: History */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <History size={20} className="text-slate-400" />
                                ประวัติการชำระเงิน
                            </h2>
                            <button onClick={loadBillingData} className="text-slate-400 hover:text-white transition-colors">
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900 text-slate-400 text-sm">
                                    <tr>
                                        <th className="px-6 py-4">วันที่แจ้ง</th>
                                        <th className="px-6 py-4">จำนวนเงิน</th>
                                        <th className="px-6 py-4">สถานะ</th>
                                        <th className="px-6 py-4">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {transactions.length > 0 ? (
                                        transactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 text-slate-300">
                                                    {new Date(tx.payment_date).toLocaleString('th-TH')}
                                                </td>
                                                <td className="px-6 py-4 text-white font-medium">
                                                    ฿{tx.amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(tx.status)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {tx.notes || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                ยังไม่มีประวัติการชำระเงิน
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>

                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white">แจ้งชำระเงิน (Inform Payment)</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">จำนวนเงินที่โอน (บาท) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    required
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="เช่น 590"
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Slip Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">อัปโหลดสลิปโอนเงิน <span className="text-red-500">*</span></label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${selectedFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800'
                                        }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        hidden
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                    />

                                    {previewUrl ? (
                                        <div className="relative h-48 w-full">
                                            <Image
                                                src={previewUrl}
                                                alt="Slip preview"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="py-4">
                                            <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                                            <p className="text-slate-400 text-sm">คลิกเพื่อเลือกไฟล์รูปภาพ</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">หมายเหตุ (ถ้ามี)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="แจ้งรายละเอียดเพิ่มเติม..."
                                    rows={2}
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    'ยืนยันการแจ้งชำระเงิน'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
