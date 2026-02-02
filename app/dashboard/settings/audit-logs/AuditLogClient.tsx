'use client';

import { useState } from 'react';

interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    old_value: any;
    new_value: any;
    created_at: string;
    profiles: {
        full_name: string | null;
        email: string;
    } | null;
}

interface Props {
    logs: AuditLog[];
    currentUserRole: string | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    create: { label: 'สร้าง', color: 'text-green-400 bg-green-500/10' },
    update: { label: 'แก้ไข', color: 'text-blue-400 bg-blue-500/10' },
    delete: { label: 'ลบ', color: 'text-red-400 bg-red-500/10' },
};

const TABLE_LABELS: Record<string, string> = {
    products: 'สินค้า',
    orders: 'ออเดอร์',
    expenses: 'ค่าใช้จ่าย',
    incomes: 'รายรับ',
    profiles: 'ผู้ใช้งาน',
    categories: 'หมวดหมู่',
};

export default function AuditLogClient({ logs, currentUserRole }: Props) {
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLogs = logs.filter(log => {
        if (filter !== 'all' && log.action !== filter) return false;
        if (searchQuery && !log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อผู้ใช้งาน..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        ทั้งหมด
                    </button>
                    <button
                        onClick={() => setFilter('create')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'create'
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        สร้าง
                    </button>
                    <button
                        onClick={() => setFilter('update')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'update'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        แก้ไข
                    </button>
                    <button
                        onClick={() => setFilter('delete')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'delete'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        ลบ
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm">ทั้งหมด</div>
                    <div className="text-2xl font-bold text-white mt-1">{logs.length}</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
                    <div className="text-green-400 text-sm">สร้าง</div>
                    <div className="text-2xl font-bold text-green-400 mt-1">
                        {logs.filter(l => l.action === 'create').length}
                    </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                    <div className="text-blue-400 text-sm">แก้ไข</div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">
                        {logs.filter(l => l.action === 'update').length}
                    </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                    <div className="text-red-400 text-sm">ลบ</div>
                    <div className="text-2xl font-bold text-red-400 mt-1">
                        {logs.filter(l => l.action === 'delete').length}
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg overflow-hidden">
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูล Audit Logs
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        เวลา
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        ผู้ใช้งาน
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        การกระทำ
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        ตาราง
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                                        Record ID
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 text-slate-300 text-sm whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-white font-medium">
                                                    {log.profiles?.full_name || 'ไม่ระบุ'}
                                                </div>
                                                <div className="text-slate-400 text-xs">
                                                    {log.profiles?.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${ACTION_LABELS[log.action]?.color || 'text-slate-400 bg-slate-500/10'
                                                }`}>
                                                {ACTION_LABELS[log.action]?.label || log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {TABLE_LABELS[log.table_name] || log.table_name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                                            {log.record_id?.substring(0, 8) || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
