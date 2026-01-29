'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Category {
    id: string;
    name: string;
    description: string | null;
}

export default function CategorySettingsPage() {
    const supabase = createClient();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
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
                .from('categories')
                .select('*')
                .eq('organization_id', profile.organization_id)
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
            { name: 'เครื่องดื่ม', description: 'น้ำดื่ม กาแฟ ชา น้ำผลไม้' },
            { name: 'อาหาร', description: 'อาหารสำเร็จรูป อาหารแห้ง' },
            { name: 'ขนม', description: 'ขนมขบเคี้ยว ขนมปัง เบเกอรี่' },
            { name: 'ของใช้', description: 'อุปกรณ์ทำความสะอาด ของใช้ทั่วไป' },
            { name: 'เครื่องสำอาง', description: 'ผลิตภัณฑ์ดูแลผิว เครื่องสำอาง' },
            { name: 'ยาและอาหารเสริม', description: 'ยาสามัญ วิตามิน อาหารเสริม' },
        ];

        setSaving(true);
        for (const cat of defaults) {
            await supabase.from('categories').insert({
                organization_id: organizationId,
                ...cat,
            });
        }

        const { data: cats } = await supabase
            .from('categories')
            .select('*')
            .eq('organization_id', organizationId)
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
                .from('categories')
                .update({
                    name: formData.name,
                    description: formData.description || null,
                })
                .eq('id', editingId);

            if (error) {
                setError(error.message);
            } else {
                setSuccess('แก้ไขหมวดหมู่สำเร็จ!');
                setEditingId(null);
            }
        } else {
            const { error } = await supabase.from('categories').insert({
                organization_id: organizationId,
                name: formData.name,
                description: formData.description || null,
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess('เพิ่มหมวดหมู่สำเร็จ!');
            }
        }

        const { data: cats } = await supabase
            .from('categories')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name');

        if (cats) setCategories(cats);
        setFormData({ name: '', description: '' });
        setSaving(false);
        setTimeout(() => setSuccess(null), 3000);
    };

    // Delete category
    const handleDelete = async (id: string) => {
        if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่? สินค้าที่อยู่ในหมวดหมู่นี้จะไม่มีหมวดหมู่')) return;

        const { error } = await supabase.from('categories').delete().eq('id', id);

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
    const handleEdit = (cat: Category) => {
        setEditingId(cat.id);
        setFormData({
            name: cat.name,
            description: cat.description || '',
        });
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({ name: '', description: '' });
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
                        href="/dashboard/inventory"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการหมวดหมู่สินค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">เพิ่ม/แก้ไข หมวดหมู่สำหรับจัดกลุ่มสินค้า</p>
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
                        <h2 className="text-lg font-semibold text-blue-400 mb-2">ยังไม่มีหมวดหมู่สินค้า</h2>
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
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-300 mb-2">ชื่อหมวดหมู่ *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="เช่น เครื่องดื่ม, อาหาร"
                                    required
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-300 mb-2">คำอธิบาย</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl disabled:opacity-50"
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

                {/* Categories List */}
                {categories.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="bg-slate-800 px-6 py-3 border-b border-slate-700/50">
                            <h3 className="font-semibold text-white">หมวดหมู่ทั้งหมด ({categories.length} รายการ)</h3>
                        </div>
                        <div className="divide-y divide-slate-700/50">
                            {categories.map((cat) => (
                                <div key={cat.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                                    <div>
                                        <span className="text-white font-medium">{cat.name}</span>
                                        {cat.description && (
                                            <p className="text-slate-500 text-sm mt-1">{cat.description}</p>
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
                )}
            </div>
        </div>
    );
}
