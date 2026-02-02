'use client';

import { useState } from 'react';
import { updateSubscriptionPlan } from './actions';
import { X, Loader2, Edit } from 'lucide-react';

export default function EditPlanModal({ plan }: { plan: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await updateSubscriptionPlan(plan.id, formData);

        setLoading(false);
        if (result.success) {
            setIsOpen(false);
        } else {
            alert(result.error);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="แก้ไขแพ็กเกจ"
            >
                <Edit size={16} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">แก้ไขแพ็กเกจ (Edit Plan)</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Read-only ID */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">รหัสแพ็กเกจ (Slug) - แก้ไขไม่ได้</label>
                        <input value={plan.name} disabled className="w-full bg-slate-800/50 border-slate-700/50 rounded-lg px-3 py-2 text-slate-400 text-sm cursor-not-allowed" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">ชื่อแพ็กเกจ (Display Name)</label>
                            <input name="display_name" defaultValue={plan.display_name} required className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">ราคา (บาท)</label>
                            <input name="price" type="number" defaultValue={plan.price} required className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">รอบบิล (Billing)</label>
                            <select name="billing_period" defaultValue={plan.billing_period} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
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
                            <input name="max_products" type="number" defaultValue={plan.max_products} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">สาขาสูงสุด</label>
                            <input name="max_branches" type="number" defaultValue={plan.max_branches} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">ผู้ใช้สูงสุด</label>
                            <input name="max_employees" type="number" defaultValue={plan.max_employees} className="w-full bg-slate-800 border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
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
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            บันทึกแก้ไข
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
