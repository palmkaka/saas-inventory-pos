'use client';

import { useState } from 'react';
import { updateOrganizationPlan } from './actions';
import { Loader2 } from 'lucide-react';

interface Plan {
    name: string; // slug
    display_name: string;
}

interface OrganizationPlanEditorProps {
    orgId: string;
    currentPlan: string;
    plans: Plan[];
}

export default function OrganizationPlanEditor({ orgId, currentPlan, plans }: OrganizationPlanEditorProps) {
    const [loading, setLoading] = useState(false);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPlan = e.target.value;
        if (newPlan === currentPlan) return;

        if (!confirm(`ต้องการเปลี่ยนแพ็กเกจเป็น "${newPlan}" ใช่หรือไม่?`)) {
            e.target.value = currentPlan; // Reset
            return;
        }

        setLoading(true);
        const result = await updateOrganizationPlan(orgId, newPlan);
        setLoading(false);

        if (!result.success) {
            alert('เปลี่ยนแพ็กเกจไม่สำเร็จ: ' + (result.error || 'Unknown error'));
            e.target.value = currentPlan; // Revert
        }
    };

    return (
        <div className="flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin text-rose-500" />}
            <select
                defaultValue={currentPlan}
                onChange={handleChange}
                disabled={loading}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg py-1 px-2 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50"
            >
                {plans.map(p => (
                    <option key={p.name} value={p.name}>
                        {p.display_name} ({p.name})
                    </option>
                ))}

                {/* Fallback if current plan is not in list (legacy) */}
                {!plans.find(p => p.name === currentPlan) && currentPlan && (
                    <option value={currentPlan}>{currentPlan} (Legacy)</option>
                )}
            </select>
        </div>
    );
}
