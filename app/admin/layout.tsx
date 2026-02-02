import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    ShieldAlert,
    BadgeCheck,
    FileText
} from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';

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

    const navItems = [
        { label: 'ภาพรวม (Dashboard)', href: '/admin', icon: LayoutDashboard },
        { label: 'จัดการร้านค้า (Organizations)', href: '/admin/organizations', icon: Building2 },
        { label: 'ตรวจสอบการชำระเงิน (Payments)', href: '/admin/payments', icon: BadgeCheck },
        { label: 'จัดการผู้ใช้ (Users)', href: '/admin/users', icon: Users },
        { label: 'Audit Logs', href: '/admin/logs', icon: FileText },
        { label: 'ตั้งค่าระบบ (Settings)', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100">
            {/* Sidebar - Distinct Dark Red/Slate Theme for Admin */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-6 border-b border-slate-800 flex items-center gap-2 text-rose-500">
                    <ShieldAlert size={32} />
                    <div>
                        <h1 className="font-bold text-lg text-white">Super Admin</h1>
                        <p className="text-xs text-rose-400">God Mode</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-4 py-3 text-slate-400">
                        <div className="w-8 h-8 rounded-full bg-rose-900/50 flex items-center justify-center text-rose-400 font-bold">
                            SA
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.email}</p>
                            <p className="text-xs text-rose-400">System Administrator</p>
                        </div>
                    </div>
                    <SignOutButton />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
