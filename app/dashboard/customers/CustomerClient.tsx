'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Customer {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    points: number;
    total_spent: number;
    visit_count: number;
    created_at: string;
}

interface LoyaltySettings {
    loyalty_enabled: boolean;
    points_per_currency: number;
    points_to_currency: number;
}

interface Props {
    customers: Customer[];
    loyaltySettings: LoyaltySettings | null;
    organizationId: string;
}

export default function CustomerClient({ customers: initialCustomers, loyaltySettings, organizationId }: Props) {
    const supabase = createClient();
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        phone: '',
        name: '',
        email: ''
    });

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
    );

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    organization_id: organizationId,
                    phone: formData.phone,
                    name: formData.name,
                    email: formData.email || null
                })
                .select()
                .single();

            if (error) throw error;

            setCustomers([data, ...customers]);
            setShowAddModal(false);
            setFormData({ phone: '', name: '', email: '' });
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(dateString));
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm">ลูกค้าทั้งหมด</div>
                    <div className="text-2xl font-bold text-white mt-1">{customers.length}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                    <div className="text-blue-400 text-sm">แต้มสะสมรวม</div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">
                        {customers.reduce((sum, c) => sum + c.points, 0).toLocaleString()}
                    </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-4">
                    <div className="text-emerald-400 text-sm">ยอดซื้อรวม</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {formatCurrency(customers.reduce((sum, c) => sum + c.total_spent, 0))}
                    </div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/50 rounded-lg p-4">
                    <div className="text-purple-400 text-sm">ยอดเฉลี่ย/คน</div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">
                        {customers.length > 0
                            ? formatCurrency(customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length)
                            : formatCurrency(0)
                        }
                    </div>
                </div>
            </div>

            {/* Search & Add */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400"
                    />
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มลูกค้า
                </button>
            </div>

            {/* Customer List */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg overflow-hidden">
                {filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        {searchQuery ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีลูกค้าในระบบ'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                                        ชื่อ
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                                        เบอร์โทร
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-300 uppercase">
                                        แต้มสะสม
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase">
                                        ยอดซื้อรวม
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-300 uppercase">
                                        จำนวนครั้ง
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                                        สมัครเมื่อ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-white font-medium">{customer.name}</div>
                                                {customer.email && (
                                                    <div className="text-slate-400 text-xs">{customer.email}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{customer.phone}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                                                {customer.points.toLocaleString()} แต้ม
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                                            {formatCurrency(customer.total_spent)}
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-300">
                                            {customer.visit_count} ครั้ง
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-sm">
                                            {formatDate(customer.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">เพิ่มลูกค้าใหม่</h2>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddCustomer} className="space-y-4">
                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    เบอร์โทร <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="0812345678"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    ชื่อ-นามสกุล <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="สมชาย ใจดี"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm font-medium mb-2">
                                    อีเมล (ไม่บังคับ)
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                    placeholder="example@email.com"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
