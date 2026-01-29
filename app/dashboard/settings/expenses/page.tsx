'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface ExpenseCategory {
    id: string;
    name: string;
    group_type: 'COST' | 'SELLING' | 'ADMIN';
    is_system: boolean;
}

const groupLabels: Record<string, string> = {
    COST: 'ต้นทุนขาย',
    SELLING: 'ค่าใช้จ่ายการขาย',
    ADMIN: 'ค่าใช้จ่ายบริหาร',
};

const groupColors: Record<string, { bg: string; text: string; border: string }> = {
    COST: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    SELLING: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    ADMIN: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
};

export default function ExpenseSettingsPage() {
    const supabase = createClient();

    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        group_type: 'ADMIN' as 'COST' | 'SELLING' | 'ADMIN',
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
                .from('expense_categories')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('group_type')
                .order('name');

            if (!error && cats) {
                setCategories(cats);
            }

            setLoading(false);
        }

        loadData();
    }, [supabase]);

    // Seed default categories if none exist
    const seedDefaults = async () => {
        if (!organizationId) return;

        const defaults = [
            { name: 'ค่าระบบ (HMS)', group_type: 'COST', is_system: true },
            { name: 'ค่าอุปกรณ์', group_type: 'COST', is_system: true },
            { name: 'ค่าโฆษณา', group_type: 'SELLING', is_system: true },
            { name: 'คอมมิชชั่น', group_type: 'SELLING', is_system: true },
            { name: 'Incentive', group_type: 'SELLING', is_system: true },
            { name: 'เงินเดือน', group_type: 'ADMIN', is_system: true },
            { name: 'ค่าเช่า', group_type: 'ADMIN', is_system: true },
            { name: 'ค่าน้ำค่าไฟ', group_type: 'ADMIN', is_system: true },
            { name: 'ค่าทำความสะอาด', group_type: 'ADMIN', is_system: true },
            { name: 'ค่าไปรษณีย์', group_type: 'ADMIN', is_system: true },
        ];

        setSaving(true);
        for (const cat of defaults) {
            await supabase.from('expense_categories').insert({
                organization_id: organizationId,
                ...cat,
            });
        }

        // Reload
        const { data: cats } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('group_type')
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

        try {
            if (editingId) {
                // Update
                const { error } = await supabase
                    .from('expense_categories')
                    .update({ name: formData.name, group_type: formData.group_type })
                    .eq('id', editingId);

                if (error) throw error;
                setSuccess('อัพเดทหมวดหมู่สำเร็จ!');
            } else {
                // Create
                const { error } = await supabase
                    .from('expense_categories')
                    .insert({
                        organization_id: organizationId,
                        name: formData.name,
                        group_type: formData.group_type,
                        is_system: false,
                    });

                if (error) throw error;
                setSuccess('เพิ่มหมวดหมู่สำเร็จ!');
            }

            // Reload
            const { data: cats } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('organization_id', organizationId)
                .order('group_type')
                .order('name');

            if (cats) setCategories(cats);

            setFormData({ name: '', group_type: 'ADMIN' });
            setEditingId(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    // Delete category
    const handleDelete = async (id: string) => {
        if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่?')) return;

        const { error } = await supabase.from('expense_categories').delete().eq('id', id);

        if (error) {
            setError('ไม่สามารถลบได้ อาจมีรายจ่ายที่ใช้หมวดหมู่นี้อยู่');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setCategories((prev) => prev.filter((c) => c.id !== id));
        setSuccess('ลบหมวดหมู่สำเร็จ!');
        setTimeout(() => setSuccess(null), 3000);
    };

    // Edit category
    const handleEdit = (cat: ExpenseCategory) => {
        setFormData({ name: cat.name, group_type: cat.group_type });
        setEditingId(cat.id);
    };

    // Cancel edit
    const handleCancel = () => {
        setFormData({ name: '', group_type: 'ADMIN' });
        setEditingId(null);
    };

    // Group categories
    const groupedCategories = {
        COST: categories.filter((c) => c.group_type === 'COST'),
        SELLING: categories.filter((c) => c.group_type === 'SELLING'),
        ADMIN: categories.filter((c) => c.group_type === 'ADMIN'),
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
                        href="/dashboard/settings"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการหมวดหมู่ค่าใช้จ่าย</h1>
                        <p className="text-slate-400 text-sm mt-1">เพิ่ม แก้ไข หรือลบหมวดหมู่ค่าใช้จ่ายของคุณ</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="p-6 max-w-4xl mx-auto space-y-6">
                {/* Alerts */}
                {success && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-emerald-400">{success}</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Seed defaults if empty */}
                {categories.length === 0 && organizationId && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h2 className="text-lg font-semibold text-white mb-2">ยังไม่มีหมวดหมู่ค่าใช้จ่าย</h2>
                        <p className="text-slate-400 mb-4">คลิกปุ่มเพื่อสร้างหมวดหมู่เริ่มต้น หรือเพิ่มเองด้านล่าง</p>
                        <button
                            onClick={seedDefaults}
                            disabled={saving}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving ? 'กำลังสร้าง...' : 'สร้างหมวดหมู่เริ่มต้น'}
                        </button>
                    </div>
                )}

                {/* Add/Edit Form */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="ชื่อหมวดหมู่ เช่น ค่ารับรองลูกค้า"
                                required
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div className="w-full md:w-56">
                            <select
                                value={formData.group_type}
                                onChange={(e) => setFormData({ ...formData, group_type: e.target.value as 'COST' | 'SELLING' | 'ADMIN' })}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="COST">ต้นทุนขาย</option>
                                <option value="SELLING">ค่าใช้จ่ายการขาย</option>
                                <option value="ADMIN">ค่าใช้จ่ายบริหาร</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-50"
                            >
                                {saving ? 'กำลังบันทึก...' : editingId ? 'อัพเดท' : 'เพิ่ม'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Categories List */}
                {(['COST', 'SELLING', 'ADMIN'] as const).map((group) => (
                    <div key={group} className={`bg-slate-800/50 border ${groupColors[group].border} rounded-xl overflow-hidden`}>
                        <div className={`px-6 py-4 ${groupColors[group].bg} border-b ${groupColors[group].border}`}>
                            <h3 className={`font-semibold ${groupColors[group].text}`}>{groupLabels[group]}</h3>
                        </div>
                        <div className="divide-y divide-slate-700/50">
                            {groupedCategories[group].length === 0 ? (
                                <div className="px-6 py-8 text-center text-slate-500">
                                    ยังไม่มีหมวดหมู่ในกลุ่มนี้
                                </div>
                            ) : (
                                groupedCategories[group].map((cat) => (
                                    <div key={cat.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white">{cat.name}</span>
                                            {cat.is_system && (
                                                <span className="text-xs px-2 py-0.5 bg-slate-600/50 text-slate-400 rounded-full">ระบบ</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEdit(cat)}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="แก้ไข"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="ลบ"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
