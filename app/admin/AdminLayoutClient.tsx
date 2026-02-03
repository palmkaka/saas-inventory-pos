'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    ShieldAlert,
    BadgeCheck,
    FileText,
    Menu,
    X
} from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';

interface AdminLayoutClientProps {
    children: React.ReactNode;
    userEmail: string;
}

export default function AdminLayoutClient({ children, userEmail }: AdminLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { label: 'ภาพรวม (Dashboard)', href: '/admin', icon: LayoutDashboard },
        { label: 'จัดการร้านค้า (Organizations)', href: '/admin/organizations', icon: Building2 },
        { label: 'ตรวจสอบการชำระเงิน (Payments)', href: '/admin/payments', icon: BadgeCheck },
        { label: 'จัดการผู้ใช้ (Users)', href: '/admin/users', icon: Users },
        { label: 'Audit Logs', href: '/admin/logs', icon: FileText },
        { label: 'ตั้งค่าระบบ (Settings)', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-500">
                    <ShieldAlert size={24} />
                    <span className="font-bold text-white">Super Admin</span>
                </div>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-slate-300 hover:text-white p-1"
                >
                    {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-50
                transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="hidden lg:flex p-6 border-b border-slate-800 items-center gap-2 text-rose-500">
                    <ShieldAlert size={32} />
                    <div>
                        <h1 className="font-bold text-lg text-white">Super Admin</h1>
                        <p className="text-xs text-rose-400">God Mode</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 mt-14 lg:mt-0 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                        ? 'bg-rose-900/20 text-rose-400 border border-rose-900/50'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3 px-4 py-3 text-slate-400 mb-2">
                        <div className="w-8 h-8 rounded-full bg-rose-900/50 flex items-center justify-center text-rose-400 font-bold">
                            SA
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                            <p className="text-xs text-rose-400">System Administrator</p>
                        </div>
                    </div>
                    <SignOutButton />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto pt-16 lg:pt-0 bg-slate-950 relative w-full">
                <div className="min-h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
