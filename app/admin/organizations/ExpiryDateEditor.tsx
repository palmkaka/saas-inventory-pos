'use client';

import { useState } from 'react';
import { Calendar, Check, X, Loader2 } from 'lucide-react';
import { updateSubscriptionExpiry } from './actions';

interface ExpiryDateEditorProps {
    orgId: string;
    currentExpiry: string | null;
}

export default function ExpiryDateEditor({ orgId, currentExpiry }: ExpiryDateEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [expiryDate, setExpiryDate] = useState(
        currentExpiry ? new Date(currentExpiry).toISOString().split('T')[0] : ''
    );
    const [saving, setSaving] = useState(false);

    const formatDisplay = (dateStr: string | null) => {
        if (!dateStr) return 'ไม่มีวันหมดอายุ';
        const date = new Date(dateStr);
        const now = new Date();
        const isExpired = date < now;

        return (
            <span className={isExpired ? 'text-red-400' : 'text-emerald-400'}>
                {date.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })}
                {isExpired && ' (หมดอายุแล้ว)'}
            </span>
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateSubscriptionExpiry(
                orgId,
                expiryDate ? new Date(expiryDate).toISOString() : null
            );
            if (result.success) {
                setIsEditing(false);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('Something went wrong');
        } finally {
            setSaving(false);
        }
    };

    if (!isEditing) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                title="คลิกเพื่อแก้ไขวันหมดอายุ"
            >
                <Calendar size={14} />
                {formatDisplay(currentExpiry)}
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
            />
            <button
                onClick={handleSave}
                disabled={saving}
                className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                title="บันทึก"
            >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
                onClick={() => {
                    setIsEditing(false);
                    setExpiryDate(currentExpiry ? new Date(currentExpiry).toISOString().split('T')[0] : '');
                }}
                className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                title="ยกเลิก"
            >
                <X size={14} />
            </button>
        </div>
    );
}
