'use client';

import { useState, useEffect } from 'react';
import { updateUserBranch, fetchOrgBranches } from './actions';
import { Check, Loader2 } from 'lucide-react';

interface Branch {
    id: string;
    name: string;
}

interface Props {
    userId: string;
    currentBranchId: string | null;
    organizationId: string | null;
    isOwner: boolean;
}

export default function UserBranchEditor({ userId, currentBranchId, organizationId, isOwner }: Props) {
    const [branchId, setBranchId] = useState<string>(currentBranchId || '');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [success, setSuccess] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Fetch branches on first interaction (hover/focus) or mount if preferred.
    // For simplicity in restricted admin view, fetch on mount if orgId exists.
    useEffect(() => {
        if (organizationId && !initialized) {
            setFetching(true);
            fetchOrgBranches(organizationId).then(data => {
                setBranches(data);
                setFetching(false);
                setInitialized(true);
            });
        }
    }, [organizationId, initialized]);

    const handleChange = async (newBranchId: string) => {
        setBranchId(newBranchId);
        setLoading(true);
        setSuccess(false);

        // Convert empty string back to null for DB
        const dbValue = newBranchId === '' ? null : newBranchId;

        await updateUserBranch(userId, dbValue);

        setLoading(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
    };

    if (!organizationId) {
        return <span className="text-slate-600 italic text-xs">No Org</span>;
    }

    // Default label for "No Branch"
    // If Owner: "Headquarters"
    // If Staff: "No Branch" (or HQ depending on logic)
    const noneLabel = isOwner ? 'สำนักงานใหญ่ (Headquarters)' : '- ไม่ระบุสาขา -';

    return (
        <div className="flex items-center gap-2">
            <select
                value={branchId}
                onChange={(e) => handleChange(e.target.value)}
                disabled={loading || fetching}
                onMouseEnter={() => !initialized && setInitialized(true)} // Lazy load backup
                className="bg-slate-800 border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1 focus:ring-rose-500 focus:border-rose-500 max-w-[150px]"
            >
                <option value="">{noneLabel}</option>
                {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
            {loading && <Loader2 size={14} className="animate-spin text-slate-500" />}
            {fetching && !loading && <Loader2 size={14} className="animate-spin text-slate-700" />}
            {success && <Check size={14} className="text-emerald-500" />}
        </div>
    );
}
