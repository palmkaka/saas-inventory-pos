'use client';

import { useState } from 'react';
import { createSubscriptionPlan } from './actions';
import { Plus, X, Loader2, LayoutGrid } from 'lucide-react';

export default function AddPlanModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await createSubscriptionPlan(formData);

        setLoading(false);
        if (result.success) {
            setIsOpen(false);
        } else {
            alert(result.error);
        }
    };

    if (!isOpen) {
        return (
            <div
                onClick={() => setIsOpen(true)}
                className="border border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-slate-600 hover:text-slate-400 hover:border-slate-600 cursor-pointer transition-all min-h-[200px]"
            >
                <LayoutGrid size={32} className="mb-2" />
                <span>เพิ่มแพ็กเกจใหม่</span>
            </div>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white"
                    >
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-bold text-white mb-6">สร้างแพ็กเกจใหม่ (Create Plan)</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">รหัสแพ็กเกจ (Slug)</label>
                                <input name="name" required placeholder="เช่น enterprise" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">ชื่อแพ็กเกจ (Display Name)</label>
                                <input name="display_name" required placeholder="เช่น Enterprise Plan" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">ราคา (บาท)</label>
                                <input name="price" type="number" required placeholder="999" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">รอบบิล (Billing)</label>
                                <select name="billing_period" className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                                    <option value="monthly">รายเดือน (Monthly)</option>
                                    <option value="yearly">รายปี (Yearly)</option>
                                    <option value="lifetime">ตลอดชีพ (Lifetime)</option>
                                </select>
                            </div>
                        </div>

                        <hr className="border-slate-800 my-2" />

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">สินค้าสูงสุด</label>
                                <input name="max_products" type="number" defaultValue={100} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">สาขาสูงสุด</label>
                                <input name="max_branches" type="number" defaultValue={1} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">ผู้ใช้สูงสุด</label>
                                <input name="max_employees" type="number" defaultValue={3} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                                <p className="text-[10px] text-slate-500 mt-1">-1 = ไม่จำกัด</p>
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
                                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                บันทึกแพ็กเกจ
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
