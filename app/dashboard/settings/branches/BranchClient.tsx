'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Branch {
    id: string;
    organization_id: string;
    name: string;
    code: string | null;
    address: string | null;
    phone: string | null;
    is_main: boolean;
}

interface Props {
    initialBranches: Branch[];
    organizationId: string;
}

export default function BranchClient({ initialBranches, organizationId }: Props) {
    const supabase = createClient();
    const router = useRouter();
    const [branches, setBranches] = useState<Branch[]>(initialBranches);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');

    const openModal = (branch?: Branch) => {
        if (branch) {
            setEditingBranch(branch);
            setName(branch.name);
            setCode(branch.code || '');
            setAddress(branch.address || '');
            setPhone(branch.phone || '');
        } else {
            setEditingBranch(null);
            setName('');
            setCode('');
            setAddress('');
            setPhone('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingBranch) {
                // Update
                const { error } = await supabase
                    .from('branches')
                    .update({ name, code, address, phone })
                    .eq('id', editingBranch.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('branches')
                    .insert({
                        organization_id: organizationId,
                        name,
                        code,
                        address,
                        phone,
                        is_main: false
                    });
                if (error) throw error;
            }

            // Refresh data
            router.refresh();
            setIsModalOpen(false);

            // Re-fetch locally for instant update
            const { data } = await supabase
                .from('branches')
                .select('*')
                .eq('organization_id', organizationId)
                .order('is_main', { ascending: false })
                .order('created_at', { ascending: true });

            if (data) setBranches(data);

        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('คุณแน่ใจหรือไม่ที่จะลบสาขานี้? ข้อมูลสต็อกและออเดอร์อาจได้รับผลกระทบ')) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('branches').delete().eq('id', id);
            if (error) throw error;
            setBranches(branches.filter(b => b.id !== id));
            router.refresh();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">รายชื่อสาขา</h2>
                <button
                    onClick={() => openModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    เพิ่มสาขา
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map((branch) => (
                    <div key={branch.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-5 hover:bg-slate-700/50 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    {branch.name}
                                    {branch.is_main && (
                                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                                            Main
                                        </span>
                                    )}
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">{branch.address || 'ไม่ระบุที่อยู่'}</p>
                                {branch.phone && (
                                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C7.82 21 2 15.18 2 5V5z" /></svg>
                                        {branch.phone}
                                    </p>
                                )}
                                {branch.code && (
                                    <p className="text-slate-500 text-xs mt-2 font-mono">CODE: {branch.code}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openModal(branch)}
                                    className="p-2 bg-slate-600 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                {!branch.is_main && (
                                    <button
                                        onClick={() => handleDelete(branch.id)}
                                        className="p-2 bg-slate-600 hover:bg-red-600 text-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-4">{editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ชื่อสาขา *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="เช่น สาขาย่อยบางนา"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">รหัสสาขา (Code)</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="เช่น BNA01"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">เบอร์โทรศัพท์</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="02-XXX-XXXX"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ที่อยู่</label>
                                <textarea
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="ที่อยู่ร้าน..."
                                />
                            </div>
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
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold disabled:opacity-50"
                                >
                                    {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
