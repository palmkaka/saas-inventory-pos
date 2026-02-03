'use client';

import { useState } from 'react';
import { Announcement, createAnnouncement, toggleAnnouncementStatus, deleteAnnouncement } from '@/app/admin/announcements/actions';
import { Megaphone, Plus, X, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnnouncementManagerProps {
    announcements: Announcement[];
}

export default function AnnouncementManager({ announcements }: AnnouncementManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await createAnnouncement({
            title: formData.get('title') as string,
            content: formData.get('content') as string,
            type: formData.get('type') as any,
            startDate: formData.get('startDate') ? new Date(formData.get('startDate') as string).toISOString() : undefined,
            endDate: formData.get('endDate') ? new Date(formData.get('endDate') as string).toISOString() : undefined,
        });

        setLoading(false);
        if (result.success) {
            setIsOpen(false);
            router.refresh();
        } else {
            alert(result.error);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'disable' : 'enable'} this announcement?`)) return;
        await toggleAnnouncementStatus(id, !currentStatus);
        router.refresh();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        await deleteAnnouncement(id);
        router.refresh();
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-white text-xl font-semibold">
                    <Megaphone className="text-blue-500" />
                    <h2>System Announcements (ประกาศระบบ)</h2>
                </div>
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                    <Plus size={16} />
                    สร้างประกาศใหม่
                </button>
            </div>

            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                        <p className="text-slate-400">ยังไม่มีประกาศในระบบ</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {announcements.map((ann) => (
                            <div key={ann.id} className={`bg-slate-900 border ${ann.is_active ? 'border-blue-500/30' : 'border-slate-800'} rounded-xl p-4 flex justify-between items-start`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider ${ann.type === 'info' ? 'bg-blue-500/20 text-blue-400' :
                                                ann.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    ann.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {ann.type}
                                        </span>
                                        <h3 className={`font-bold ${ann.is_active ? 'text-white' : 'text-slate-500'}`}>{ann.title}</h3>
                                        {!ann.is_active && <span className="text-xs text-slate-500">(Disabled)</span>}
                                    </div>
                                    <p className="text-slate-400 text-sm mb-2">{ann.content}</p>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>Start: {ann.start_date ? new Date(ann.start_date).toLocaleDateString('th-TH') : 'Immediate'}</span>
                                        <span>End: {ann.end_date ? new Date(ann.end_date).toLocaleDateString('th-TH') : 'No Expiry'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(ann.id, ann.is_active)}
                                        className={`p-2 rounded-lg transition-colors ${ann.is_active ? 'text-blue-400 hover:bg-blue-500/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}
                                        title={ann.is_active ? "Disable" : "Enable"}
                                    >
                                        {ann.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ann.id)}
                                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-6">สร้างประกาศใหม่</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">หัวข้อประกาศ (Title)</label>
                                <input name="title" required placeholder="เช่น ปิดปรับปรุงระบบ..." className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">รายละเอียด (Content)</label>
                                <textarea name="content" rows={3} placeholder="รายละเอียดเพิ่มเติม..." className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">ประเภท (Type)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['info', 'warning', 'danger', 'success'].map((type) => (
                                        <label key={type} className="cursor-pointer">
                                            <input type="radio" name="type" value={type} defaultChecked={type === 'info'} className="peer sr-only" />
                                            <div className="text-center px-2 py-2 rounded-lg bg-slate-800 border-slate-700 peer-checked:bg-blue-600 peer-checked:text-white text-slate-400 text-sm capitalize transition-all">
                                                {type}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">เริ่มวันที่ (Start Date)</label>
                                    <input type="datetime-local" name="startDate" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">สิ้นสุดวันที่ (End Date)</label>
                                    <input type="datetime-local" name="endDate" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    {loading && <Loader2 size={16} className="animate-spin" />}
                                    สร้างประกาศ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
