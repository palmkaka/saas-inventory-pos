'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
    is_active: boolean;
    target_plans: string[] | null;
    start_date: string;
    end_date: string | null;
    created_at: string;
}

export default function AnnouncementsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        title: '',
        content: '',
        type: 'info',
        target_plans: [] as string[],
        end_date: ''
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

        await fetchAnnouncements();
        setLoading(false);
    }

    async function fetchAnnouncements() {
        const { data } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        setAnnouncements(data || []);
    }

    async function saveAnnouncement() {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            title: form.title,
            content: form.content,
            type: form.type,
            target_plans: form.target_plans.length > 0 ? form.target_plans : null,
            end_date: form.end_date || null,
            created_by: user?.id
        };

        if (editingId) {
            await supabase
                .from('announcements')
                .update(payload)
                .eq('id', editingId);
        } else {
            await supabase
                .from('announcements')
                .insert(payload);
        }

        setIsModalOpen(false);
        resetForm();
        fetchAnnouncements();
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        await supabase
            .from('announcements')
            .update({ is_active: !currentStatus })
            .eq('id', id);
        fetchAnnouncements();
    }

    async function deleteAnnouncement(id: string) {
        if (!confirm('ยืนยันการลบประกาศนี้?')) return;
        await supabase.from('announcements').delete().eq('id', id);
        fetchAnnouncements();
    }

    function openEdit(ann: Announcement) {
        setEditingId(ann.id);
        setForm({
            title: ann.title,
            content: ann.content,
            type: ann.type,
            target_plans: ann.target_plans || [],
            end_date: ann.end_date?.split('T')[0] || ''
        });
        setIsModalOpen(true);
    }

    function resetForm() {
        setEditingId(null);
        setForm({
            title: '',
            content: '',
            type: 'info',
            target_plans: [],
            end_date: ''
        });
    }

    const togglePlan = (plan: string) => {
        setForm(prev => ({
            ...prev,
            target_plans: prev.target_plans.includes(plan)
                ? prev.target_plans.filter(p => p !== plan)
                : [...prev.target_plans, plan]
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
                        <h1 className="text-2xl font-bold">📢 จัดการประกาศ</h1>
                        <p className="text-slate-400 text-sm">ส่งประกาศถึงร้านค้าทั้งหมด</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                    ➕ สร้างประกาศ
                </button>
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
                        ยังไม่มีประกาศ
                    </div>
                ) : (
                    announcements.map(ann => (
                        <div
                            key={ann.id}
                            className={`bg-slate-800/50 border rounded-xl p-4 ${ann.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${ann.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                                ann.type === 'maintenance' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {ann.type === 'warning' ? '⚠️ แจ้งเตือน' :
                                                ann.type === 'maintenance' ? '🔧 ปิดปรับปรุง' :
                                                    'ℹ️ ข้อมูล'}
                                        </span>
                                        {!ann.is_active && (
                                            <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                                                ปิดใช้งาน
                                            </span>
                                        )}
                                        {ann.target_plans && ann.target_plans.length > 0 && (
                                            <span className="text-slate-500 text-xs">
                                                เฉพาะ: {ann.target_plans.join(', ')}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold">{ann.title}</h3>
                                    <p className="text-slate-400 mt-1">{ann.content}</p>
                                    <div className="text-slate-500 text-xs mt-2">
                                        สร้างเมื่อ: {new Date(ann.created_at).toLocaleDateString('th-TH')}
                                        {ann.end_date && ` • หมดอายุ: ${new Date(ann.end_date).toLocaleDateString('th-TH')}`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleActive(ann.id, ann.is_active)}
                                        className={`px-3 py-1 rounded text-xs ${ann.is_active
                                                ? 'bg-amber-600 hover:bg-amber-700'
                                                : 'bg-emerald-600 hover:bg-emerald-700'
                                            }`}
                                    >
                                        {ann.is_active ? '⏸️ ปิด' : '▶️ เปิด'}
                                    </button>
                                    <button
                                        onClick={() => openEdit(ann)}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                                    >
                                        ✏️ แก้ไข
                                    </button>
                                    <button
                                        onClick={() => deleteAnnouncement(ann.id)}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                    >
                                        🗑️ ลบ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">
                            {editingId ? '✏️ แก้ไขประกาศ' : '📢 สร้างประกาศใหม่'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">หัวข้อ</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="หัวข้อประกาศ"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">เนื้อหา</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    rows={4}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    placeholder="รายละเอียดประกาศ..."
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">ประเภท</label>
                                <div className="flex gap-2">
                                    {['info', 'warning', 'maintenance'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setForm({ ...form, type })}
                                            className={`px-3 py-1 rounded-lg text-sm ${form.type === type
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-slate-700 text-slate-400'
                                                }`}
                                        >
                                            {type === 'info' ? 'ℹ️ ข้อมูล' :
                                                type === 'warning' ? '⚠️ แจ้งเตือน' :
                                                    '🔧 ปิดปรับปรุง'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">
                                    แสดงเฉพาะแพ็กเกจ (เว้นว่าง = ทุกแพ็กเกจ)
                                </label>
                                <div className="flex gap-2">
                                    {['free', 'starter', 'business', 'enterprise'].map(plan => (
                                        <button
                                            key={plan}
                                            onClick={() => togglePlan(plan)}
                                            className={`px-3 py-1 rounded-lg text-sm ${form.target_plans.includes(plan)
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-700 text-slate-400'
                                                }`}
                                        >
                                            {plan}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-sm mb-1">
                                    วันหมดอายุ (ไม่บังคับ)
                                </label>
                                <input
                                    type="date"
                                    value={form.end_date}
                                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                />
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
                                onClick={saveAnnouncement}
                                disabled={!form.title.trim() || !form.content.trim()}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg font-bold"
                            >
                                {editingId ? 'บันทึก' : 'สร้างประกาศ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
