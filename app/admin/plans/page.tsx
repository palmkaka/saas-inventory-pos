'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Plan {
    id: string;
    name: string;
    display_name: string;
    price: number;
    billing_period: string;
    max_products: number;
    max_branches: number;
    max_employees: number;
    features: Record<string, boolean>;
    is_active: boolean;
    sort_order: number;
}

export default function PlansPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState({
        name: '',
        display_name: '',
        price: 0,
        billing_period: 'monthly',
        max_products: 100,
        max_branches: 1,
        max_employees: 5,
        features: {
            pos: true,
            reports: false,
            api: false,
            priority_support: false
        }
    });

    useEffect(() => {
        checkAccessAndFetch();
    }, []);

    async function checkAccessAndFetch() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/auth/login');
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_super_admin) {
            router.push('/dashboard');
            return;
        }

        await fetchPlans();
        setLoading(false);
    }

    async function fetchPlans() {
        const { data } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('sort_order');

        setPlans(data || []);
    }

    async function savePlan() {
        const payload = {
            name: form.name.toLowerCase().replace(/\s+/g, '_'),
            display_name: form.display_name,
            price: form.price,
            billing_period: form.billing_period,
            max_products: form.max_products,
            max_branches: form.max_branches,
            max_employees: form.max_employees,
            features: form.features
        };

        if (editingPlan) {
            await supabase
                .from('subscription_plans')
                .update(payload)
                .eq('id', editingPlan.id);
        } else {
            await supabase
                .from('subscription_plans')
                .insert({ ...payload, sort_order: plans.length + 1 });
        }

        setIsModalOpen(false);
        resetForm();
        fetchPlans();
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        await supabase
            .from('subscription_plans')
            .update({ is_active: !currentStatus })
            .eq('id', id);
        fetchPlans();
    }

    function openEdit(plan: Plan) {
        setEditingPlan(plan);
        setForm({
            name: plan.name,
            display_name: plan.display_name,
            price: plan.price,
            billing_period: plan.billing_period,
            max_products: plan.max_products,
            max_branches: plan.max_branches,
            max_employees: plan.max_employees,
            features: (plan.features as any) || {
                pos: true,
                reports: false,
                api: false,
                priority_support: false
            }
        });
        setIsModalOpen(true);
    }

    function resetForm() {
        setEditingPlan(null);
        setForm({
            name: '',
            display_name: '',
            price: 0,
            billing_period: 'monthly',
            max_products: 100,
            max_branches: 1,
            max_employees: 5,
            features: {
                pos: true,
                reports: false,
                api: false,
                priority_support: false
            }
        });
    }

    const toggleFeature = (feature: string) => {
        setForm(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [feature]: !prev.features[feature as keyof typeof prev.features]
            }
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white">กำลังโหลด...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="text-slate-400 hover:text-white">
                        ← กลับ
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">💎 จัดการแพ็กเกจ</h1>
                        <p className="text-slate-400 text-sm">ตั้งค่า Subscription Plans</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                    ➕ สร้างแพ็กเกจ
                </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map(plan => (
                    <div
                        key={plan.id}
                        className={`bg-slate-800/50 border rounded-xl p-4 ${plan.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold">{plan.display_name}</h3>
                            {!plan.is_active && (
                                <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                                    ปิดใช้งาน
                                </span>
                            )}
                        </div>

                        <div className="text-3xl font-bold mb-1">
                            ฿{plan.price.toLocaleString()}
                            <span className="text-slate-400 text-sm font-normal">
                                /{plan.billing_period === 'yearly' ? 'ปี' : 'เดือน'}
                            </span>
                        </div>

                        <div className="border-t border-slate-700 my-3 pt-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">สินค้า</span>
                                <span>{plan.max_products === -1 ? 'ไม่จำกัด' : plan.max_products}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">สาขา</span>
                                <span>{plan.max_branches === -1 ? 'ไม่จำกัด' : plan.max_branches}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">พนักงาน</span>
                                <span>{plan.max_employees === -1 ? 'ไม่จำกัด' : plan.max_employees}</span>
                            </div>
                        </div>

                        <div className="border-t border-slate-700 my-3 pt-3 space-y-1 text-sm">
                            {Object.entries(plan.features || {}).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className={value ? 'text-emerald-400' : 'text-slate-600'}>
                                        {value ? '✓' : '✗'}
                                    </span>
                                    <span className={value ? 'text-white' : 'text-slate-600'}>
                                        {key === 'pos' ? 'POS ขายสินค้า' :
                                            key === 'reports' ? 'รายงานขั้นสูง' :
                                                key === 'api' ? 'API Access' :
                                                    key === 'priority_support' ? 'Priority Support' :
                                                        key}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => toggleActive(plan.id, plan.is_active)}
                                className={`flex-1 px-3 py-1 rounded text-xs ${plan.is_active
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                            >
                                {plan.is_active ? '⏸️ ปิด' : '▶️ เปิด'}
                            </button>
                            <button
                                onClick={() => openEdit(plan)}
                                className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                            >
                                ✏️ แก้ไข
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">
                            {editingPlan ? '✏️ แก้ไขแพ็กเกจ' : '💎 สร้างแพ็กเกจใหม่'}
                        </h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">ชื่อ (code)</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="starter"
                                        disabled={!!editingPlan}
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">ชื่อแสดง</label>
                                    <input
                                        type="text"
                                        value={form.display_name}
                                        onChange={e => setForm({ ...form, display_name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="Starter"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">ราคา (บาท)</label>
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">รอบบิล</label>
                                    <select
                                        value={form.billing_period}
                                        onChange={e => setForm({ ...form, billing_period: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="monthly">รายเดือน</option>
                                        <option value="yearly">รายปี</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">สินค้า (-1=ไม่จำกัด)</label>
                                    <input
                                        type="number"
                                        value={form.max_products}
                                        onChange={e => setForm({ ...form, max_products: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">สาขา</label>
                                    <input
                                        type="number"
                                        value={form.max_branches}
                                        onChange={e => setForm({ ...form, max_branches: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm mb-1">พนักงาน</label>
                                    <input
                                        type="number"
                                        value={form.max_employees}
                                        onChange={e => setForm({ ...form, max_employees: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-2">ฟีเจอร์</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['pos', 'reports', 'api', 'priority_support'].map(feature => (
                                        <label key={feature} className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={form.features[feature as keyof typeof form.features]}
                                                onChange={() => toggleFeature(feature)}
                                                className="w-4 h-4 rounded accent-purple-600"
                                            />
                                            <span className="text-sm">
                                                {feature === 'pos' ? 'POS ขายสินค้า' :
                                                    feature === 'reports' ? 'รายงานขั้นสูง' :
                                                        feature === 'api' ? 'API Access' :
                                                            'Priority Support'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={savePlan}
                                disabled={!form.name.trim() || !form.display_name.trim()}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg font-bold"
                            >
                                {editingPlan ? 'บันทึก' : 'สร้างแพ็กเกจ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
