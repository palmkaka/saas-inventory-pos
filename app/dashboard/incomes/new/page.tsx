'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface IncomeCategory {
    id: string;
    name: string;
    income_type: 'SALES' | 'SERVICE' | 'OTHER';
}

const typeLabels: Record<string, string> = {
    SALES: 'รายได้จากการขาย',
    SERVICE: 'รายได้จากบริการ',
    OTHER: 'รายได้อื่นๆ',
};

export default function NewIncomePage() {
    const router = useRouter();
    const supabase = createClient();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [categories, setCategories] = useState<IncomeCategory[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    const [formData, setFormData] = useState({
        category_id: '',
        title: '',
        amount: '',
        income_date: new Date().toISOString().split('T')[0],
        payer_name: '',
        notes: '',
    });

    // Group categories by type
    const groupedCategories = {
        SALES: categories.filter((c) => c.income_type === 'SALES'),
        SERVICE: categories.filter((c) => c.income_type === 'SERVICE'),
        OTHER: categories.filter((c) => c.income_type === 'OTHER'),
    };

    useEffect(() => {
        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (profile?.organization_id) {
                setOrganizationId(profile.organization_id);

                // Fetch categories
                const { data: cats } = await supabase
                    .from('income_categories')
                    .select('id, name, income_type')
                    .eq('organization_id', profile.organization_id)
                    .order('income_type')
                    .order('name');

                if (cats) {
                    setCategories(cats);
                }
            }
            setLoadingCategories(false);
        }
        fetchData();
    }, [supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || !formData.category_id) return;

        setError(null);
        setSaving(true);

        try {
            const { error: insertError } = await supabase.from('incomes').insert({
                organization_id: organizationId,
                category_id: formData.category_id,
                title: formData.title,
                amount: parseFloat(formData.amount) || 0,
                income_date: formData.income_date,
                payer_name: formData.payer_name || null,
                notes: formData.notes || null,
            });

            if (insertError) throw insertError;

            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard/incomes');
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/incomes"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">เพิ่มรายรับ</h1>
                        <p className="text-slate-400 text-sm mt-1">บันทึกรายได้ใหม่</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 max-w-2xl mx-auto">
                {success && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-emerald-400">บันทึกรายรับสำเร็จ! กำลังกลับ...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-400">{error}</p>
                        </div>
                    </div>
                )}

                {loadingCategories ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-lg font-semibold text-yellow-400 mb-2">ยังไม่มีหมวดหมู่รายรับ</h2>
                        <p className="text-yellow-400/80 mb-4">กรุณาสร้างหมวดหมู่ก่อนเพิ่มรายรับ</p>
                        <Link
                            href="/dashboard/settings/incomes"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-semibold rounded-xl"
                        >
                            ไปจัดการหมวดหมู่
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Category Selection */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                หมวดหมู่รายรับ
                            </h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    เลือกหมวดหมู่ <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                >
                                    <option value="">-- เลือกหมวดหมู่ --</option>
                                    {(['SALES', 'SERVICE', 'OTHER'] as const).map((type) => (
                                        groupedCategories[type].length > 0 && (
                                            <optgroup key={type} label={typeLabels[type]}>
                                                {groupedCategories[type].map((cat) => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </optgroup>
                                        )
                                    ))}
                                </select>
                                <Link
                                    href="/dashboard/settings/incomes"
                                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm mt-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    จัดการหมวดหมู่
                                </Link>
                            </div>
                        </div>

                        {/* Income Details */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                รายละเอียดรายรับ
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        รายละเอียด <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        placeholder="เช่น ค่าที่ปรึกษาโปรเจค A"
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        จำนวนเงิน (฿) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        วันที่ <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.income_date}
                                        onChange={(e) => setFormData({ ...formData, income_date: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        ชื่อผู้จ่าย (ถ้ามี)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.payer_name}
                                        onChange={(e) => setFormData({ ...formData, payer_name: e.target.value })}
                                        placeholder="เช่น บริษัท ABC จำกัด"
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>กำลังบันทึก...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>บันทึกรายรับ</span>
                                    </>
                                )}
                            </button>
                            <Link
                                href="/dashboard/incomes"
                                className="px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors font-medium"
                            >
                                ยกเลิก
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
