import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CustomerClient from './CustomerClient';

interface Customer {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    points: number;
    total_spent: number;
    visit_count: number;
    created_at: string;
}

async function getCustomers() {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { customers: [], loyaltySettings: null };
    }

    // Fetch loyalty settings
    const { data: orgData } = await supabase
        .from('organizations')
        .select('loyalty_enabled, points_per_currency, points_to_currency')
        .eq('id', profile.organization_id)
        .single();

    // Fetch customers
    const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching customers:', error);
        return { customers: [], loyaltySettings: orgData };
    }

    return {
        customers: customers || [],
        loyaltySettings: orgData,
        organizationId: profile.organization_id
    };
}

export default async function CustomersPage() {
    const data = await getCustomers();

    if ('error' in data) {
        redirect('/');
    }

    const { customers, loyaltySettings, organizationId } = data;

    return (
        <div className="min-h-screen bg-slate-900">
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">จัดการลูกค้า</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            ระบบสะสมแต้มและจัดการข้อมูลลูกค้า
                        </p>
                    </div>
                    {loyaltySettings && (
                        <div className="hidden md:flex items-center gap-4 text-sm">
                            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg px-4 py-2">
                                <div className="text-blue-400 font-medium">
                                    {loyaltySettings.points_per_currency} บาท = 1 แต้ม
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg px-4 py-2">
                                <div className="text-emerald-400 font-medium">
                                    {loyaltySettings.points_to_currency} แต้ม = 1 บาท
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="p-6">
                <CustomerClient
                    customers={customers}
                    loyaltySettings={loyaltySettings}
                    organizationId={organizationId}
                />
            </main>
        </div>
    );
}
