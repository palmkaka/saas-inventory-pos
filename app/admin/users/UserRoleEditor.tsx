'use client';

import { useState } from 'react';
import { updateUserRole } from './actions';
import { Check, Loader2 } from 'lucide-react';

export default function UserRoleEditor({ userId, currentRole }: { userId: string, currentRole: string }) {
    const [role, setRole] = useState(currentRole);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const roles = ['owner', 'manager', 'accountant', 'staff', 'hr'];

    const handleChange = async (newRole: string) => {
        setRole(newRole);
        setLoading(true);
        setSuccess(false);

        await updateUserRole(userId, newRole);

        setLoading(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
    };

    return (
        <div className="flex items-center gap-2">
            <select
                value={role}
                onChange={(e) => handleChange(e.target.value)}
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1 focus:ring-rose-500 focus:border-rose-500 capitalize"
            >
                {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </select>
            {loading && <Loader2 size={14} className="animate-spin text-slate-500" />}
            {success && <Check size={14} className="text-emerald-500" />}
        </div>
    );
}
