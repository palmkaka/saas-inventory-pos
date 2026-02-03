import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AdminLayoutClient from './AdminLayoutClient';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check if user is super admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.is_super_admin) {
        redirect('/dashboard');
    }

    return (
        <AdminLayoutClient userEmail={user.email || 'Super Admin'}>
            {children}
        </AdminLayoutClient>
    );
}
