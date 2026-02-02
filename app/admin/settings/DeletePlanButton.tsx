'use client';

import { useState } from 'react';
import { deleteSubscriptionPlan } from './actions';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeletePlanButton({ planId }: { planId: string }) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm('ยืนยันที่จะลบแพ็กเกจนี้? (การลบจะไม่ส่งผลต่อร้านค้าที่สมัครไปแล้ว)')) return;

        setLoading(true);
        await deleteSubscriptionPlan(planId);
        setLoading(false);
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="ลบแพ็กเกจ"
        >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
    );
}
