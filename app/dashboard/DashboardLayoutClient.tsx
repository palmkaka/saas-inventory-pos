'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Announcement } from '@/app/admin/announcements/actions';
import { Megaphone, X } from 'lucide-react';

interface MenuItem {
    name: string;
    icon: string;
    href: string;
}

interface DashboardLayoutClientProps {
    menuItems: MenuItem[];
    user: { email: string };
    profile: { full_name: string; role: string; branch_name?: string; is_platform_admin?: boolean; is_super_admin?: boolean };
    children: React.ReactNode;
    isImpersonating?: boolean;
    announcements?: Announcement[];
}
import { stopImpersonating } from '@/app/admin/actions/impersonate';

// กำหนดเมนูที่แต่ละ Role เห็นได้
const ROLE_MENU_ACCESS: Record<string, string[]> = {
    owner: ['ภาพรวม', 'ขายสินค้า', 'กะการทำงาน', 'ระบบลงเวลา', 'เงินเดือน', 'คลังสินค้า', 'ลูกค้า', 'รายรับ', 'ค่าใช้จ่าย', 'รายงาน', 'งบกำไรขาดทุน', 'คอมมิชชั่น', 'จัดการผู้ใช้งาน', 'ประวัติการใช้งาน', 'ตั้งค่า'],
    manager: ['ภาพรวม', 'ขายสินค้า', 'กะการทำงาน', 'ระบบลงเวลา', 'เงินเดือน', 'คลังสินค้า', 'ลูกค้า', 'รายงาน', 'คอมมิชชั่น', 'ประวัติการใช้งาน', 'ตั้งค่า'],
    accountant: ['ภาพรวม', 'ลูกค้า', 'รายรับ', 'ค่าใช้จ่าย', 'รายงาน', 'งบกำไรขาดทุน', 'คอมมิชชั่น', 'เงินเดือน', 'ตั้งค่า'],
    hr: ['ภาพรวม', 'ระบบลงเวลา', 'เงินเดือน', 'จัดการผู้ใช้งาน', 'ตั้งค่า'],
    sales: ['ภาพรวม', 'ขายสินค้า', 'ลูกค้า'],
    inventory: ['ภาพรวม', 'คลังสินค้า'],
    staff: ['ภาพรวม', 'ขายสินค้า', 'กะการทำงาน', 'ระบบลงเวลา'], // Legacy fallback
};

export default function DashboardLayoutClient({
    menuItems,
    user,
    profile,
    children,
    isImpersonating = false,
    announcements = [],
}: DashboardLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-slate-900 flex">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white p-0.5 shadow-lg">
                        <img src="/logo.jpg" alt="EVOLUTION HRD" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white font-bold text-sm">EVOLUTION HRD</span>
                </div>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-white p-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {sidebarOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
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
                w-64 bg-slate-800 border-r border-slate-700/50 flex flex-col fixed h-full z-50
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                {/* Logo */}
                <div className="p-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white p-0.5 shadow-lg">
                            <img src="/logo.jpg" alt="EVOLUTION HRD" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-white font-bold text-sm">EVOLUTION HRD</span>
                    </div>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {menuItems
                        .filter(item => {
                            const allowedMenus = ROLE_MENU_ACCESS[profile.role] || [];
                            return allowedMenus.includes(item.name);
                        })
                        .map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                        }`}
                                >
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                    </svg>
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                </nav>

                {/* Super Admin Link */}
                {(profile.is_platform_admin || profile.is_super_admin) && (
                    <div className="px-4 pb-2">
                        <Link
                            href="/admin"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-lg shadow-purple-900/20"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            <span className="font-bold">ไปหน้า Super Admin</span>
                        </Link>
                    </div>
                )}

                {/* User Section */}
                <div className="p-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                                {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{profile?.full_name || 'User'}</p>
                            <p className="text-slate-500 text-xs truncate mb-1">{user?.email}</p>
                            {profile.branch_name && (
                                <p className="text-yellow-400 text-xs truncate mb-1">
                                    🏢 {profile.branch_name}
                                </p>
                            )}
                            <p className="text-emerald-400 text-xs font-medium mt-0.5">
                                {(profile.is_platform_admin || profile.is_super_admin) ? '🛡️ Super Admin' : (
                                    <>
                                        {profile.role === 'owner' && '👑 เจ้าของ'}
                                        {profile.role === 'manager' && '📊 ผู้จัดการ'}
                                        {profile.role === 'accountant' && '💰 ฝ่ายบัญชี'}
                                        {profile.role === 'hr' && '👥 ฝ่ายบุคคล'}
                                        {profile.role === 'sales' && '🛒 พนักงานขาย'}
                                        {profile.role === 'inventory' && '📦 พนักงานคลัง'}
                                        {profile.role === 'staff' && '👤 พนักงาน'}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 overflow-auto pt-14 lg:pt-0 pb-16 lg:pb-0">
                {isImpersonating && (
                    <div className="bg-purple-600 text-white px-4 py-2 flex justify-between items-center shadow-lg mb-4 sticky top-0 z-30">
                        <div className="flex items-center gap-2">
                            <span className="bg-white/20 p-1.5 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </span>
                            <div>
                                <p className="text-sm font-bold">Impersonation Mode Active</p>
                                <p className="text-xs text-purple-100">คุณกำลังใช้งานในนามของร้านค้านี้</p>
                            </div>
                        </div>
                        <button
                            onClick={() => stopImpersonating()}
                            className="bg-white text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors shadow-sm"
                        >
                            Stop Impersonating
                        </button>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}
