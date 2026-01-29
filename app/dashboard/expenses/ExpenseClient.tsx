'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface DeleteExpenseButtonProps {
    expenseId: string;
}

export function DeleteExpenseButton({ expenseId }: DeleteExpenseButtonProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleDelete = async () => {
        const confirmed = confirm('Are you sure you want to delete this expense?');
        if (!confirmed) return;

        const { error } = await supabase.from('expenses').delete().eq('id', expenseId);

        if (error) {
            alert('Failed to delete expense: ' + error.message);
            return;
        }

        router.refresh();
    };

    return (
        <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
    );
}
