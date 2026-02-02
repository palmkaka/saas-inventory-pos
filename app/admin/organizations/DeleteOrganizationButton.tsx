'use client';

import { useState } from 'react';
import { deleteOrganization } from './actions';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteOrganizationButton({ orgId, orgName }: { orgId: string, orgName: string }) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        const confirmMessage = `คำเตือน: การลบร้านค้า "${orgName}" จะทำให้ข้อมูลทั้งหมด (สินค้า, ยอดขาย, พนักงาน) หายไปและกู้คืนไม่ได้!\n\nคุณแน่ใจหรือไม่ที่จะลบ?`;
        if (!confirm(confirmMessage)) return;

        // Double confirm
        if (!confirm('ยืนยันครั้งสุดท้าย! ต้องการลบจริงหรือไม่?')) return;

        setLoading(true);
        const result = await deleteOrganization(orgId);
        setLoading(false);

        if (!result.success) {
            alert(result.error);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="ลบร้านค้าถาวร"
        >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
    );
}
