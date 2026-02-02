'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

interface CommissionSetting {
    id: string;
    name: string;
    commission_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    rate: number;
    applies_to: 'ALL' | 'CATEGORY' | 'PRODUCT';
    category_id: string | null;
    product_id: string | null;
    is_active: boolean;
    category?: { name: string };
    product?: { name: string };
}

interface Category {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
}

export default function CommissionSettingsPage() {
    const supabase = createClient();
    const [settings, setSettings] = useState<CommissionSetting[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [commissionType, setCommissionType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
    const [rate, setRate] = useState('');
    const [appliesTo, setAppliesTo] = useState<'ALL' | 'CATEGORY' | 'PRODUCT'>('ALL');
    const [categoryId, setCategoryId] = useState('');
    const [productId, setProductId] = useState('');

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

        // Fetch commission settings
        const { data: settingsData } = await supabase
            .from('commission_settings')
            .select(`
                *,
                category:categories(name),
                product:products(name)
            `)
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        // Fetch categories
        const { data: categoriesData } = await supabase
            .from('categories')
            .select('id, name')
            .eq('organization_id', profile.organization_id);

        // Fetch products
        const { data: productsData } = await supabase
            .from('products')
            .select('id, name')
            .eq('organization_id', profile.organization_id);

        setSettings(settingsData || []);
        setCategories(categoriesData || []);
        setProducts(productsData || []);
        setLoading(false);
    }

    const openModal = (setting?: CommissionSetting) => {
        if (setting) {
            setEditingId(setting.id);
            setName(setting.name);
            setCommissionType(setting.commission_type);
            setRate(setting.rate.toString());
            setAppliesTo(setting.applies_to);
            setCategoryId(setting.category_id || '');
            setProductId(setting.product_id || '');
        } else {
            setEditingId(null);
            setName('');
            setCommissionType('PERCENTAGE');
            setRate('');
            setAppliesTo('ALL');
            setCategoryId('');
            setProductId('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return;

        const payload = {
            organization_id: profile.organization_id,
            name,
            commission_type: commissionType,
            rate: parseFloat(rate),
            applies_to: appliesTo,
            category_id: appliesTo === 'CATEGORY' ? categoryId : null,
            product_id: appliesTo === 'PRODUCT' ? productId : null,
        };

        if (editingId) {
            await supabase.from('commission_settings').update(payload).eq('id', editingId);
        } else {
            await supabase.from('commission_settings').insert(payload);
        }

        setIsModalOpen(false);
        fetchData();
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        await supabase
            .from('commission_settings')
            .update({ is_active: !currentStatus })
            .eq('id', id);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ยืนยันการลบกฎคอมมิชชั่นนี้?')) return;
        await supabase.from('commission_settings').delete().eq('id', id);
        fetchData();
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">ตั้งค่าคอมมิชชั่น</h1>
                    <p className="text-slate-400">กำหนดกฎการคำนวณคอมมิชชั่นสำหรับพนักงาน</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/dashboard/reports/commission"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2"
                    >
                        📊 รายงานคอมมิชชั่น
                    </Link>
                    <button
                        onClick={() => openModal()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        เพิ่มกฎใหม่
                    </button>
                </div>
            </div>

            {/* Settings List */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
                ) : settings.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        ยังไม่มีกฎคอมมิชชั่น กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่มต้น
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-4">ชื่อกฎ</th>
                                <th className="px-6 py-4">ประเภท</th>
                                <th className="px-6 py-4">อัตรา</th>
                                <th className="px-6 py-4">ใช้กับ</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {settings.map((setting) => (
                                <tr key={setting.id} className="hover:bg-slate-700/30">
                                    <td className="px-6 py-4 font-medium text-white">{setting.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs ${setting.commission_type === 'PERCENTAGE'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {setting.commission_type === 'PERCENTAGE' ? 'เปอร์เซ็นต์' : 'บาทต่อชิ้น'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-lg text-white">
                                        {setting.rate}{setting.commission_type === 'PERCENTAGE' ? '%' : '฿'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {setting.applies_to === 'ALL' && 'สินค้าทั้งหมด'}
                                        {setting.applies_to === 'CATEGORY' && `หมวด: ${setting.category?.name || '-'}`}
                                        {setting.applies_to === 'PRODUCT' && `สินค้า: ${setting.product?.name || '-'}`}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleActive(setting.id, setting.is_active)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${setting.is_active
                                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                    : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'
                                                }`}
                                        >
                                            {setting.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openModal(setting)}
                                                className="p-2 bg-slate-600 hover:bg-blue-600 rounded-lg transition-colors"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(setting.id)}
                                                className="p-2 bg-slate-600 hover:bg-red-600 rounded-lg transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingId ? 'แก้ไขกฎคอมมิชชั่น' : 'เพิ่มกฎคอมมิชชั่นใหม่'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ชื่อกฎ *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="เช่น คอมมิชชั่นทั่วไป"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ประเภท *</label>
                                <select
                                    value={commissionType}
                                    onChange={e => setCommissionType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="PERCENTAGE">เปอร์เซ็นต์ (%)</option>
                                    <option value="FIXED_AMOUNT">บาทต่อชิ้น (฿)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">
                                    อัตรา ({commissionType === 'PERCENTAGE' ? '%' : '฿'}) *
                                </label>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={rate}
                                    onChange={e => setRate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder={commissionType === 'PERCENTAGE' ? 'เช่น 5' : 'เช่น 10'}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ใช้กับ *</label>
                                <select
                                    value={appliesTo}
                                    onChange={e => setAppliesTo(e.target.value as 'ALL' | 'CATEGORY' | 'PRODUCT')}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="ALL">สินค้าทั้งหมด</option>
                                    <option value="CATEGORY">เฉพาะหมวดหมู่</option>
                                    <option value="PRODUCT">เฉพาะสินค้า</option>
                                </select>
                            </div>

                            {appliesTo === 'CATEGORY' && (
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">เลือกหมวดหมู่ *</label>
                                    <select
                                        required
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="">-- เลือกหมวดหมู่ --</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {appliesTo === 'PRODUCT' && (
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">เลือกสินค้า *</label>
                                    <select
                                        required
                                        value={productId}
                                        onChange={e => setProductId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="">-- เลือกสินค้า --</option>
                                        {products.map(prod => (
                                            <option key={prod.id} value={prod.id}>{prod.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                                    disabled={loading}
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
