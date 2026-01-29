'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface IncomeCategory {
    id: string;
    name: string;
    income_type: 'SALES' | 'SERVICE' | 'OTHER';
    is_system: boolean;
}

const typeLabels: Record<string, string> = {
    SALES: 'รายได้จากการขาย',
    SERVICE: 'รายได้จากบริการ',
    OTHER: 'รายได้อื่นๆ',
};

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    SALES: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    SERVICE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    OTHER: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

export default function IncomeSettingsPage() {
    const supabase = createClient();

    const [categories, setCategories] = useState<IncomeCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        income_type: 'OTHER' as 'SALES' | 'SERVICE' | 'OTHER',
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch categories
    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile?.organization_id) {
                setLoading(false);
                return;
            }

            setOrganizationId(profile.organization_id);

            const { data: cats, error } = await supabase
                .from('income_categories')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('income_type')
                .order('name');

            if (!error && cats) {
                setCategories(cats);
            }

            setLoading(false);
        }

        loadData();
    }, [supabase]);

    // Seed default categories
    const seedDefaults = async () => {
        if (!organizationId) return;

        const defaults = [
            { name: 'ขายสินค้า', income_type: 'SALES', is_system: true },
            { name: 'ขายสินค้าออนไลน์', income_type: 'SALES', is_system: true },
            { name: 'ค่าบริการ', income_type: 'SERVICE', is_system: true },
            { name: 'ค่าที่ปรึกษา', income_type: 'SERVICE', is_system: true },
            { name: 'ค่าเช่า', income_type: 'OTHER', is_system: true },
            { name: 'ดอกเบี้ยรับ', income_type: 'OTHER', is_system: true },
            { name: 'รายได้อื่น', income_type: 'OTHER', is_system: true },
        ];

        setSaving(true);
        for (const cat of defaults) {
            await supabase.from('income_categories').insert({
                organization_id: organizationId,
                ...cat,
            });
        }

        const { data: cats } = await supabase
            .from('income_categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('income_type')
            .order('name');

        if (cats) setCategories(cats);
        setSaving(false);
        setSuccess('สร้างหมวดหมู่เริ่มต้นเสร็จแล้ว!');
        setTimeout(() => setSuccess(null), 3000);
    };

    // Save category
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || !formData.name.trim()) return;

        setSaving(true);
        setError(null);

        if (editingId) {
            const { error } = await supabase
                .from('income_categories')
                .update({
                    name: formData.name,
                    income_type: formData.income_type,
                })
                .eq('id', editingId);

            if (error) {
                setError(error.message);
            } else {
                setSuccess('แก้ไขหมวดหมู่สำเร็จ!');
                setEditingId(null);
            }
        } else {
            const { error } = await supabase.from('income_categories').insert({
                organization_id: organizationId,
                name: formData.name,
                income_type: formData.income_type,
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess('เพิ่มหมวดหมู่สำเร็จ!');
            }
        }

        const { data: cats } = await supabase
            .from('income_categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('income_type')
            .order('name');

        if (cats) setCategories(cats);
        setFormData({ name: '', income_type: 'OTHER' });
        setSaving(false);
        setTimeout(() => setSuccess(null), 3000);
    };

    // Delete category
    const handleDelete = async (id: string) => {
        if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่?')) return;

        const { error } = await supabase.from('income_categories').delete().eq('id', id);

        if (error) {
            setError(error.message);
            setTimeout(() => setError(null), 3000);
            return;
        }

        setCategories(categories.filter((c) => c.id !== id));
        setSuccess('ลบหมวดหมู่สำเร็จ!');
        setTimeout(() => setSuccess(null), 3000);
    };

    // Edit category
    const handleEdit = (cat: IncomeCategory) => {
        setEditingId(cat.id);
        setFormData({
            name: cat.name,
            income_type: cat.income_type,
        });
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({ name: '', income_type: 'OTHER' });
    };

    // Group by type
    const groupedCategories = {
        SALES: categories.filter((c) => c.income_type === 'SALES'),
        SERVICE: categories.filter((c) => c.income_type === 'SERVICE'),
        OTHER: categories.filter((c) => c.income_type === 'OTHER'),
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

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
                        <h1 className="text-2xl font-bold text-white">จัดการหมวดหมู่รายรับ</h1>
                        <p className="text-slate-400 text-sm mt-1">เพิ่ม/แก้ไข หมวดหมู่สำหรับบันทึกรายรับ</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 max-w-4xl mx-auto space-y-6">
                {/* Alerts */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <p className="text-emerald-400">{success}</p>
                    </div>
                )}

                {/* Seed Button */}
                {categories.length === 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
                        <h2 className="text-lg font-semibold text-blue-400 mb-2">ยังไม่มีหมวดหมู่รายรับ</h2>
                        <p className="text-blue-400/80 mb-4">กดปุ่มเพื่อสร้างหมวดหมู่เริ่มต้น</p>
                        <button
                            onClick={seedDefaults}
                            disabled={saving}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                            {saving ? 'กำลังสร้าง...' : 'สร้างหมวดหมู่เริ่มต้น'}
                        </button>
                    </div>
                )}

                {/* Add/Edit Form */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="ชื่อหมวดหมู่"
                            required
                            className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={formData.income_type}
                            onChange={(e) => setFormData({ ...formData, income_type: e.target.value as 'SALES' | 'SERVICE' | 'OTHER' })}
                            className="px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="SALES">รายได้จากการขาย</option>
                            <option value="SERVICE">รายได้จากบริการ</option>
                            <option value="OTHER">รายได้อื่นๆ</option>
                        </select>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50"
                            >
                                {saving ? 'กำลังบันทึก...' : editingId ? 'อัพเดท' : 'เพิ่ม'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl"
                                >
                                    ยกเลิก
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Categories by Type */}
                {(['SALES', 'SERVICE', 'OTHER'] as const).map((type) => (
                    groupedCategories[type].length > 0 && (
                        <div key={type} className={`border ${typeColors[type].border} rounded-xl overflow-hidden`}>
                            <div className={`${typeColors[type].bg} px-6 py-3 border-b ${typeColors[type].border}`}>
                                <h3 className={`font-semibold ${typeColors[type].text}`}>{typeLabels[type]}</h3>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                                {groupedCategories[type].map((cat) => (
                                    <div key={cat.id} className="px-6 py-4 flex items-center justify-between bg-slate-800/30">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white">{cat.name}</span>
                                            {cat.is_system && (
                                                <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">ระบบ</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(cat)}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
}
