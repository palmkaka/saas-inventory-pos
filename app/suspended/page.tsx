import { createClient } from '@/utils/supabase/server';
import { ShieldAlert, LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/SignOutButton';

export default async function SuspendedPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Double check status, if active, redirect to dashboard
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .single();

    if (profile?.is_active) {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert size={32} />
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">บัญชีถูกระงับ (Account Suspended)</h1>
                    <p className="text-slate-400">
                        บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานชั่วคราว <br />
                        กรุณาติดต่อผู้ดูแลระบบหากคุณคิดว่านี่เป็นข้อผิดพลาด
                    </p>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-500">
                    Email: <span className="text-slate-300">{user.email}</span>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <SignOutButton />
                </div>
            </div>
        </div>
    );
}
