import { createClient } from '@/utils/supabase/server';
import BranchClient from './BranchClient';

export default async function BranchesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return null;

    // Fetch all branches
    const { data: branches } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('is_main', { ascending: false })
        .order('created_at', { ascending: true });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">จัดการสาขา (Branch Management)</h1>
                <p className="text-slate-400">เพิ่มและจัดการสาขาของร้านค้า</p>
            </div>

            <BranchClient initialBranches={branches || []} organizationId={profile.organization_id} />
        </div>
    );
}
